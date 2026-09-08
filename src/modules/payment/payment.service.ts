/* eslint-disable no-console */
import Stripe from "stripe";
import { envConfig } from "../../config/env-config";
import CustomError from "../../utils/customError";
import { prisma } from "../../config/db";
import {
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    Prisma,
} from "../../../generated/prisma";
import { consumeCheckoutSession } from "../../helpers/checkout";
import { persistOrder } from "../../helpers/create-order";
import { OrderCalculation } from "../../types/common.types";

// Initialize Stripe
const stripe = new Stripe(envConfig.stripe_secret_key as string, {
    apiVersion: "2025-07-30.basil",
});

/**
 * Handle Stripe webhook events
 * SECURITY: Verifies webhook signature to prevent tampering
 */
const handleStripeWebhook = async (body: Buffer, signature: string) => {
    let event: Stripe.Event;

    // 1. Verify webhook signature
    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            envConfig.stripe_webhook_secret as string,
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "unknown error";
        console.error("Webhook signature verification failed:", message);
        throw new CustomError(400, `Webhook Error: ${message}`);
    }

    // 2. Handle different event types
    switch (event.type) {
        case "checkout.session.completed":
            await handleCheckoutSessionCompleted(
                event.data.object as Stripe.Checkout.Session,
            );
            break;

        case "checkout.session.expired":
            await handleCheckoutSessionExpired(
                event.data.object as Stripe.Checkout.Session,
            );
            break;

        case "payment_intent.succeeded":
            await handlePaymentIntentSucceeded(
                event.data.object as Stripe.PaymentIntent,
            );
            break;

        case "payment_intent.payment_failed":
            await handlePaymentIntentFailed(
                event.data.object as Stripe.PaymentIntent,
            );
            break;

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
};

/**
 * Create the order for a completed Stripe checkout.
 *
 * The cart is read back from the CheckoutSession draft the request created —
 * never from Stripe metadata, which is too small to hold a multi-vendor cart.
 * Redeeming that draft inside the transaction is what makes this idempotent:
 * Stripe retries webhooks, and the second delivery finds the draft already
 * COMPLETED and returns without writing a duplicate order.
 */
async function handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
) {
    console.log("Processing checkout session:", session.id);

    const checkoutSessionId = session.metadata?.checkoutSessionId;
    const orderNumber = session.metadata?.orderNumber;

    if (!checkoutSessionId || !orderNumber) {
        throw new CustomError(
            400,
            "Stripe session is missing checkoutSessionId/orderNumber metadata",
        );
    }

    // Fast path for a replayed webhook — cheaper than opening a transaction.
    const existingOrder = await prisma.order.findUnique({
        where: { orderNumber },
        select: { id: true },
    });

    if (existingOrder) {
        console.log(`Order ${orderNumber} already exists, skipping creation`);
        return;
    }

    const draft = await prisma.checkoutSession.findUnique({
        where: { id: checkoutSessionId },
    });

    if (!draft) {
        throw new CustomError(404, "Checkout session not found");
    }

    // SECURITY: the charge must match what we priced. Stripe reports the
    // amount in cents; compare with a one-cent tolerance.
    const paidAmount = (session.amount_total ?? 0) / 100;
    const expectedAmount = parseFloat(draft.amountTotal.toString());

    if (Math.abs(paidAmount - expectedAmount) > 0.01) {
        throw new CustomError(
            400,
            `Amount mismatch: charged=${paidAmount}, expected=${expectedAmount}`,
        );
    }

    const paymentIntentId =
        typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;

    try {
        const order = await prisma.$transaction(async (tx) => {
            const claimed = await consumeCheckoutSession(
                tx,
                checkoutSessionId,
            );

            // Payment already succeeded, so the order opens in PROCESSING and
            // each vendor can start fulfilling immediately.
            return persistOrder(tx, {
                orderNumber: claimed.orderNumber,
                userId: claimed.userId,
                shippingAddressId: claimed.shippingAddressId,
                calculation: claimed.calculation as OrderCalculation,
                paymentMethod: PaymentMethod.STRIPE,
                paymentStatus: PaymentStatus.PAID,
                initialVendorStatus: OrderStatus.PROCESSING,
                notes: claimed.notes,
                ipAddress: claimed.ipAddress,
                userAgent: claimed.userAgent,
                transactionId: paymentIntentId,
                paymentGateway: "stripe",
                gatewayResponse: session as unknown as Prisma.InputJsonValue,
                paidAt: new Date(),
            });
        });

        console.log(
            `Order ${order.orderNumber} created with ${order.vendorOrders.length} vendor order(s)`,
        );
    } catch (error) {
        // A concurrent delivery won the race — that is success, not failure.
        if (error instanceof CustomError && error.statusCode === 409) {
            console.log(
                `Checkout session ${checkoutSessionId} already consumed, skipping`,
            );
            return;
        }

        throw error;
    }
}

/** Stripe's own expiry for an abandoned checkout page. */
async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
    const checkoutSessionId = session.metadata?.checkoutSessionId;

    if (!checkoutSessionId) return;

    await prisma.checkoutSession.updateMany({
        where: { id: checkoutSessionId, status: "PENDING" },
        data: { status: "EXPIRED" },
    });
}

/**
 * Handle successful payment intent (backup/additional logging)
 */
async function handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
) {
    console.log("Payment intent succeeded:", paymentIntent.id);

    // Update payment record if it exists
    const payment = await prisma.payment.findUnique({
        where: { transactionId: paymentIntent.id },
    });

    if (payment) {
        await prisma.payment.update({
            where: { id: payment.id },
            data: {
                status: PaymentStatus.PAID,
                paidAt: new Date(),
                gatewayResponse:
                    paymentIntent as unknown as Prisma.InputJsonValue,
            },
        });
    }
}

/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    console.log("Payment intent failed:", paymentIntent.id);

    // Find and update payment record
    const payment = await prisma.payment.findUnique({
        where: { transactionId: paymentIntent.id },
    });

    if (payment) {
        await prisma.payment.update({
            where: { id: payment.id },
            data: {
                status: PaymentStatus.FAILED,
                failureReason: paymentIntent.last_payment_error?.message,
                gatewayResponse:
                    paymentIntent as unknown as Prisma.InputJsonValue,
            },
        });

        // Update order status
        await prisma.order.update({
            where: { id: payment.orderId },
            data: {
                paymentStatus: PaymentStatus.FAILED,
            },
        });
    }
}

export const paymentServices = {
    handleStripeWebhook,
};
