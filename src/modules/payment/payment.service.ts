/* eslint-disable no-console */
import Stripe from "stripe";
import { envConfig } from "@/config/env-config";
import CustomError from "@/utils/customError";
import { prisma } from "@/config/db";
import {
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    Prisma,
    RefundStatus,
    Role,
} from "@/lib/prisma-client";
import { consumeCheckoutSession } from "@/helpers/checkout";
import {
    mapStripeRefundStatus,
    recomputePaymentRefundState,
} from "@/helpers/refund";
import { round2 } from "@/helpers/money";
import { persistOrder } from "@/helpers/create-order";
import { notifyOrderPlaced } from "@/helpers/notifications";
import { OrderCalculation } from "@/types/common.types";
import { buyerPaymentSelect } from "@/helpers/payment";
import PrismaQueryBuilder from "@/lib/PrismaQueryBuilder";

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

        // Refund lifecycle. These matter even though we create refunds
        // ourselves: a refund issued from the Stripe dashboard, or one on a
        // rail that settles asynchronously, only reaches us this way.
        //
        // `charge.refund.updated` is the LEGACY name for the same thing. A
        // webhook endpoint pinned to an older api_version (anything before the
        // `refund.*` events existed) emits only that one, so listening for
        // both is what makes this work regardless of how the endpoint is
        // configured. All four carry a Refund object.
        case "refund.created":
        case "refund.updated":
        case "refund.failed":
        case "charge.refund.updated":
            await handleRefundEvent(event.data.object as Stripe.Refund);
            break;

        case "charge.refunded":
            await handleChargeRefunded(event.data.object as Stripe.Charge);
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

        // Outside the transaction above. Non-fatal: a webhook that already
        // created the order must not be retried by Stripe because an email
        // bounced.
        await notifyOrderPlaced(order.id);
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

/**
 * Reconcile one refund against the gateway's view of it.
 *
 * Matches on `gatewayRefundId` first — that is our own refund coming back. If
 * there is no match the refund was created outside this system (an operator
 * using the Stripe dashboard), and we record it so the ledger and
 * `Payment.refundAmount` still reflect reality.
 */
async function handleRefundEvent(stripeRefund: Stripe.Refund) {
    // Shared with the reconciliation sweep in `helpers/refund.ts` — one
    // definition, so the webhook and the sweep cannot disagree.
    const status = mapStripeRefundStatus(stripeRefund.status);

    const existing = await prisma.refund.findUnique({
        where: { gatewayRefundId: stripeRefund.id },
    });

    if (existing) {
        // Never walk a settled refund backwards on a late duplicate event.
        if (existing.status === RefundStatus.SUCCEEDED) return;

        await prisma.refund.update({
            where: { id: existing.id },
            data: {
                status,
                gatewayResponse:
                    stripeRefund as unknown as Prisma.InputJsonValue,
                processedAt:
                    status === RefundStatus.SUCCEEDED ? new Date() : null,
                failureReason:
                    status === RefundStatus.FAILED
                        ? (stripeRefund.failure_reason ??
                          "Gateway reported the refund as failed")
                        : null,
            },
        });

        await recomputePaymentRefundState(existing.paymentId);
        return;
    }

    // Unknown refund: adopt it. Our own refunds carry `refundId` in metadata,
    // so anything without it was raised elsewhere.
    const paymentIntentId =
        typeof stripeRefund.payment_intent === "string"
            ? stripeRefund.payment_intent
            : stripeRefund.payment_intent?.id;

    if (!paymentIntentId) return;

    const payment = await prisma.payment.findUnique({
        where: { transactionId: paymentIntentId },
    });

    if (!payment) {
        console.log(
            `Refund ${stripeRefund.id}: no local payment for intent ${paymentIntentId}`,
        );
        return;
    }

    await prisma.refund.create({
        data: {
            orderId: payment.orderId,
            paymentId: payment.id,
            amount: round2((stripeRefund.amount ?? 0) / 100),
            currency: stripeRefund.currency ?? "usd",
            status,
            reason: "Refunded at the gateway, outside Trendora",
            gateway: "stripe",
            gatewayRefundId: stripeRefund.id,
            idempotencyKey: `gateway:${stripeRefund.id}`,
            gatewayResponse: stripeRefund as unknown as Prisma.InputJsonValue,
            processedAt:
                status === RefundStatus.SUCCEEDED ? new Date() : null,
        },
    });

    await recomputePaymentRefundState(payment.id);

    console.log(
        `Adopted external refund ${stripeRefund.id} on order ${payment.orderId}`,
    );
}

/**
 * A charge-level summary of everything refunded on it. Used as a backstop:
 * `charge.refunded` fires even when an individual refund event is missed, so
 * this makes sure the payment total is right regardless.
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
    const paymentIntentId =
        typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;

    if (!paymentIntentId) return;

    const payment = await prisma.payment.findUnique({
        where: { transactionId: paymentIntentId },
    });

    if (!payment) return;

    // Adopt any refund on this charge we have not seen.
    for (const refund of charge.refunds?.data ?? []) {
        const known = await prisma.refund.findUnique({
            where: { gatewayRefundId: refund.id },
        });

        if (!known) {
            await handleRefundEvent(refund);
        }
    }

    await recomputePaymentRefundState(payment.id);
}

// ---------------------------------------------------------------------- reads
//
// The `Payment` row was write-only until now: the webhook created it and
// nothing ever read it back. These endpoints are deliberately READ-ONLY —
// payment state is owned by the gateway and reconciled by the webhook and
// `reconcilePayment`, never set by a client.

type TActor = { id: string; role: string };

/** The caller's own payments, newest first. */
const findMine = async (actor: TActor, query: Record<string, unknown>) => {
    const builder = new PrismaQueryBuilder<Prisma.PaymentWhereInput>(query, {
        model: "Payment",
    });

    const prismaArgs = builder
        .withDefaultFilter({ order: { is: { userId: actor.id } } })
        .filter()
        .paginate()
        .sort("createdAt", "desc")
        .build();

    const [payments, meta] = await Promise.all([
        prisma.payment.findMany({
            ...prismaArgs,
            select: {
                ...buyerPaymentSelect,
                order: { select: { id: true, orderNumber: true } },
            },
        }),
        builder.getMeta(prisma.payment),
    ]);

    return { meta, data: payments };
};

/**
 * The payment on one order, for the buyer who placed it or an ADMIN.
 *
 * A seller is deliberately not an audience here: one payment covers every
 * store on the order, so there is no slice of it that belongs to one vendor.
 * What a seller legitimately needs — has the buyer paid? — is already on their
 * own parcel read as `order.paymentStatus`.
 *
 * 404 rather than 403 for someone else's order, so order ids stay unguessable.
 */
const findByOrderId = async (actor: TActor, orderId: string) => {
    if (actor.role === Role.ADMIN) {
        const payment = await prisma.payment.findUnique({
            where: { orderId },
            include: { refunds: { orderBy: { createdAt: "desc" } } },
        });

        if (!payment) {
            throw new CustomError(404, "Payment not found");
        }

        return payment;
    }

    const payment = await prisma.payment.findFirst({
        where: { orderId, order: { is: { userId: actor.id } } },
        select: {
            ...buyerPaymentSelect,
            order: { select: { id: true, orderNumber: true } },
        },
    });

    if (!payment) {
        throw new CustomError(404, "Payment not found");
    }

    return payment;
};

/** Every payment, for the admin ledger. `?status=FAILED` narrows it. */
const findAllForAdmin = async (query: Record<string, unknown>) => {
    const builder = new PrismaQueryBuilder<Prisma.PaymentWhereInput>(query, {
        model: "Payment",
    });

    const prismaArgs = builder
        .filter()
        .paginate()
        .sort("createdAt", "desc")
        .include({
            order: {
                select: {
                    id: true,
                    orderNumber: true,
                    orderStatus: true,
                    user: { select: { id: true, name: true } },
                },
            },
            _count: { select: { refunds: true } },
        })
        .build();

    const [payments, meta] = await Promise.all([
        prisma.payment.findMany(prismaArgs),
        builder.getMeta(prisma.payment),
    ]);

    return { meta, data: payments };
};

/**
 * One payment in full, ADMIN only — this is the single place
 * `gatewayResponse` is returned, and the reason it is kept at all: it is what
 * an operator reconciles against the Stripe dashboard when the ledger and the
 * gateway disagree.
 */
const findById = async (id: string) => {
    const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
            refunds: { orderBy: { createdAt: "desc" } },
            order: {
                select: {
                    id: true,
                    orderNumber: true,
                    orderStatus: true,
                    paymentStatus: true,
                    totalAmount: true,
                    user: { select: { id: true, name: true } },
                },
            },
        },
    });

    if (!payment) {
        throw new CustomError(404, "Payment not found");
    }

    return payment;
};

export const paymentServices = {
    handleStripeWebhook,
    findMine,
    findByOrderId,
    findAllForAdmin,
    findById,
};
