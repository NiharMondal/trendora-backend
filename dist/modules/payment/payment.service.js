"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentServices = void 0;
/* eslint-disable no-console */
const stripe_1 = __importDefault(require("stripe"));
const env_config_1 = require("../../config/env-config");
const customError_1 = __importDefault(require("../../utils/customError"));
const db_1 = require("../../config/db");
const prisma_1 = require("../../../generated/prisma");
const checkout_1 = require("../../helpers/checkout");
const create_order_1 = require("../../helpers/create-order");
// Initialize Stripe
const stripe = new stripe_1.default(env_config_1.envConfig.stripe_secret_key, {
    apiVersion: "2025-07-30.basil",
});
/**
 * Handle Stripe webhook events
 * SECURITY: Verifies webhook signature to prevent tampering
 */
const handleStripeWebhook = async (body, signature) => {
    let event;
    // 1. Verify webhook signature
    try {
        event = stripe.webhooks.constructEvent(body, signature, env_config_1.envConfig.stripe_webhook_secret);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        console.error("Webhook signature verification failed:", message);
        throw new customError_1.default(400, `Webhook Error: ${message}`);
    }
    // 2. Handle different event types
    switch (event.type) {
        case "checkout.session.completed":
            await handleCheckoutSessionCompleted(event.data.object);
            break;
        case "checkout.session.expired":
            await handleCheckoutSessionExpired(event.data.object);
            break;
        case "payment_intent.succeeded":
            await handlePaymentIntentSucceeded(event.data.object);
            break;
        case "payment_intent.payment_failed":
            await handlePaymentIntentFailed(event.data.object);
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
async function handleCheckoutSessionCompleted(session) {
    console.log("Processing checkout session:", session.id);
    const checkoutSessionId = session.metadata?.checkoutSessionId;
    const orderNumber = session.metadata?.orderNumber;
    if (!checkoutSessionId || !orderNumber) {
        throw new customError_1.default(400, "Stripe session is missing checkoutSessionId/orderNumber metadata");
    }
    // Fast path for a replayed webhook — cheaper than opening a transaction.
    const existingOrder = await db_1.prisma.order.findUnique({
        where: { orderNumber },
        select: { id: true },
    });
    if (existingOrder) {
        console.log(`Order ${orderNumber} already exists, skipping creation`);
        return;
    }
    const draft = await db_1.prisma.checkoutSession.findUnique({
        where: { id: checkoutSessionId },
    });
    if (!draft) {
        throw new customError_1.default(404, "Checkout session not found");
    }
    // SECURITY: the charge must match what we priced. Stripe reports the
    // amount in cents; compare with a one-cent tolerance.
    const paidAmount = (session.amount_total ?? 0) / 100;
    const expectedAmount = parseFloat(draft.amountTotal.toString());
    if (Math.abs(paidAmount - expectedAmount) > 0.01) {
        throw new customError_1.default(400, `Amount mismatch: charged=${paidAmount}, expected=${expectedAmount}`);
    }
    const paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    try {
        const order = await db_1.prisma.$transaction(async (tx) => {
            const claimed = await (0, checkout_1.consumeCheckoutSession)(tx, checkoutSessionId);
            // Payment already succeeded, so the order opens in PROCESSING and
            // each vendor can start fulfilling immediately.
            return (0, create_order_1.persistOrder)(tx, {
                orderNumber: claimed.orderNumber,
                userId: claimed.userId,
                shippingAddressId: claimed.shippingAddressId,
                calculation: claimed.calculation,
                paymentMethod: prisma_1.PaymentMethod.STRIPE,
                paymentStatus: prisma_1.PaymentStatus.PAID,
                initialVendorStatus: prisma_1.OrderStatus.PROCESSING,
                notes: claimed.notes,
                ipAddress: claimed.ipAddress,
                userAgent: claimed.userAgent,
                transactionId: paymentIntentId,
                paymentGateway: "stripe",
                gatewayResponse: session,
                paidAt: new Date(),
            });
        });
        console.log(`Order ${order.orderNumber} created with ${order.vendorOrders.length} vendor order(s)`);
    }
    catch (error) {
        // A concurrent delivery won the race — that is success, not failure.
        if (error instanceof customError_1.default && error.statusCode === 409) {
            console.log(`Checkout session ${checkoutSessionId} already consumed, skipping`);
            return;
        }
        throw error;
    }
}
/** Stripe's own expiry for an abandoned checkout page. */
async function handleCheckoutSessionExpired(session) {
    const checkoutSessionId = session.metadata?.checkoutSessionId;
    if (!checkoutSessionId)
        return;
    await db_1.prisma.checkoutSession.updateMany({
        where: { id: checkoutSessionId, status: "PENDING" },
        data: { status: "EXPIRED" },
    });
}
/**
 * Handle successful payment intent (backup/additional logging)
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
    console.log("Payment intent succeeded:", paymentIntent.id);
    // Update payment record if it exists
    const payment = await db_1.prisma.payment.findUnique({
        where: { transactionId: paymentIntent.id },
    });
    if (payment) {
        await db_1.prisma.payment.update({
            where: { id: payment.id },
            data: {
                status: prisma_1.PaymentStatus.PAID,
                paidAt: new Date(),
                gatewayResponse: paymentIntent,
            },
        });
    }
}
/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(paymentIntent) {
    console.log("Payment intent failed:", paymentIntent.id);
    // Find and update payment record
    const payment = await db_1.prisma.payment.findUnique({
        where: { transactionId: paymentIntent.id },
    });
    if (payment) {
        await db_1.prisma.payment.update({
            where: { id: payment.id },
            data: {
                status: prisma_1.PaymentStatus.FAILED,
                failureReason: paymentIntent.last_payment_error?.message,
                gatewayResponse: paymentIntent,
            },
        });
        // Update order status
        await db_1.prisma.order.update({
            where: { id: payment.orderId },
            data: {
                paymentStatus: prisma_1.PaymentStatus.FAILED,
            },
        });
    }
}
exports.paymentServices = {
    handleStripeWebhook,
};
