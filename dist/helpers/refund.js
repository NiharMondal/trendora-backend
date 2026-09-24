"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapStripeRefundStatus = void 0;
exports.recordRefundIntent = recordRefundIntent;
exports.processRefund = processRefund;
exports.recordManualRefund = recordManualRefund;
exports.cancelRefund = cancelRefund;
exports.recomputePaymentRefundState = recomputePaymentRefundState;
exports.processPendingRefunds = processPendingRefunds;
exports.reconcileProcessingRefunds = reconcileProcessingRefunds;
exports.outstandingRefundForOrder = outstandingRefundForOrder;
/* eslint-disable no-console */
const prisma_client_1 = require("../lib/prisma-client.js");
const db_1 = require("../config/db.js");
const customError_1 = __importDefault(require("../utils/customError.js"));
const money_1 = require("./money");
const stripe_1 = require("./stripe");
/**
 * Refunds.
 *
 * The mirror of payouts: a Payout settles what the platform owes a vendor, a
 * Refund settles what it owes a buyer.
 *
 * The shape of this module is driven by one rule: **never call a payment
 * gateway from inside a database transaction.** A network call would hold the
 * transaction open for its duration, and — worse — if the transaction rolled
 * back after Stripe had already moved money, the refund would exist at the
 * gateway with no record of it here.
 *
 * So it is a two-phase flow:
 *   1. `recordRefundIntent(tx, …)` writes a PENDING Refund row inside the same
 *      transaction that cancels the parcel. Either both happen or neither does.
 *   2. `processRefund(id)` runs after the commit and does the gateway call,
 *      then writes the outcome back.
 *
 * If phase 2 never runs (process died, Stripe down), the row is left PENDING
 * and `processPendingRefunds()` picks it up. Nothing is lost, and no money
 * moves twice.
 */
/** Refunds still owed and safe to attempt. */
const RETRYABLE = [prisma_client_1.RefundStatus.PENDING, prisma_client_1.RefundStatus.FAILED];
/**
 * Derives the Stripe idempotency key for one attempt.
 *
 * Keyed on the refund row AND the attempt number: an accidental replay of the
 * same attempt reuses the key (Stripe replays its stored response instead of
 * refunding again), while a deliberate retry after a failure gets a fresh key
 * and is a genuinely new request.
 */
const idempotencyKeyFor = (refundId, attempt) => `refund:${refundId}:${attempt}`;
/**
 * Whether the buyer's money actually reached the platform. Both the automatic
 * refund and a hand-recorded one start from this: nothing collected, nothing
 * to give back.
 */
const wasCollected = (orderPaymentStatus, paymentStatus) => [orderPaymentStatus, paymentStatus].some((status) => status === prisma_client_1.PaymentStatus.PAID ||
    status === prisma_client_1.PaymentStatus.PARTIALLY_REFUNDED);
/**
 * Record that a buyer is owed money for a cancelled parcel.
 *
 * MUST run inside the transaction that cancels the parcel. Returns the refund
 * id to process after commit, or null when there is nothing to refund.
 *
 * Returns null (rather than throwing) for the cases where no gateway refund is
 * appropriate — an unpaid order, cash on delivery, or a parcel that already has
 * a refund — because cancelling must still succeed in all of those.
 */
async function recordRefundIntent(tx, params) {
    if (params.amount <= 0)
        return null;
    const order = await tx.order.findUnique({
        where: { id: params.orderId },
        include: { payment: true },
    });
    if (!order?.payment)
        return null;
    // Nothing was ever collected, so there is nothing to give back.
    if (!wasCollected(order.paymentStatus, order.payment.status))
        return null;
    // Cash on delivery has no gateway to call. The money, if any changed
    // hands, is returned in person — an admin records that separately with
    // `recordManualRefund`.
    if (order.paymentMethod === prisma_client_1.PaymentMethod.CASH_ON_DELIVERY)
        return null;
    // `vendorOrderId` is unique, so a replayed cancel finds the existing row
    // instead of creating a second refund for the same goods.
    const existing = await tx.refund.findUnique({
        where: { vendorOrderId: params.vendorOrderId },
    });
    if (existing) {
        return RETRYABLE.includes(existing.status) ? existing.id : null;
    }
    // Never ask the gateway for more than is left on the charge.
    const alreadyRefunded = await sumSucceededRefunds(tx, order.payment.id);
    const refundable = (0, money_1.round2)((0, money_1.toNumber)(order.payment.amount) - alreadyRefunded);
    if (refundable <= 0)
        return null;
    const amount = (0, money_1.round2)(Math.min(params.amount, refundable));
    if (amount <= 0)
        return null;
    const refund = await tx.refund.create({
        data: {
            orderId: params.orderId,
            paymentId: order.payment.id,
            vendorOrderId: params.vendorOrderId,
            amount,
            status: prisma_client_1.RefundStatus.PENDING,
            reason: params.reason,
            gateway: "stripe",
            // Replaced with the attempt-scoped key when it is actually sent;
            // this placeholder just satisfies the unique constraint.
            idempotencyKey: `pending:${params.vendorOrderId}`,
        },
    });
    return refund.id;
}
/**
 * Send a recorded refund to the gateway and write back the outcome.
 *
 * Runs AFTER the cancelling transaction has committed. Safe to call twice: a
 * refund that is already SUCCEEDED is returned untouched.
 *
 * A gateway failure is recorded on the row and re-thrown only when `throwOnError`
 * is set. The cancel-a-parcel path calls it with `throwOnError: false`, because
 * the cancellation itself has already succeeded and must not be reported as
 * failed just because Stripe is briefly unavailable.
 */
async function processRefund(refundId, options = {}) {
    const refund = await db_1.prisma.refund.findUnique({
        where: { id: refundId },
        include: { payment: true },
    });
    if (!refund) {
        throw new customError_1.default(404, "Refund not found");
    }
    if (refund.status === prisma_client_1.RefundStatus.SUCCEEDED) {
        return refund;
    }
    if (refund.status === prisma_client_1.RefundStatus.CANCELED) {
        throw new customError_1.default(400, "This refund was cancelled");
    }
    const paymentIntentId = refund.payment.transactionId;
    if (!paymentIntentId) {
        // A paid Stripe order always has one; without it we cannot identify
        // the charge, so this needs a human.
        const message = "No gateway transaction on this payment — refund it manually at the gateway";
        await db_1.prisma.refund.update({
            where: { id: refundId },
            data: { status: prisma_client_1.RefundStatus.FAILED, failureReason: message },
        });
        if (options.throwOnError)
            throw new customError_1.default(422, message);
        console.error(`Refund ${refundId}: ${message}`);
        return db_1.prisma.refund.findUniqueOrThrow({ where: { id: refundId } });
    }
    const attempt = refund.attempts + 1;
    const idempotencyKey = idempotencyKeyFor(refund.id, attempt);
    // Claim the attempt before the call, so a crash mid-flight leaves a
    // PROCESSING row an operator can reconcile rather than a silent PENDING
    // one that gets retried with a different key.
    await db_1.prisma.refund.update({
        where: { id: refundId },
        data: {
            status: prisma_client_1.RefundStatus.PROCESSING,
            attempts: attempt,
            idempotencyKey,
            failureReason: null,
        },
    });
    try {
        const stripeRefund = await (0, stripe_1.createStripeRefund)({
            paymentIntentId,
            amount: (0, money_1.toNumber)(refund.amount),
            idempotencyKey,
            reason: refund.reason ?? undefined,
            metadata: {
                orderId: refund.orderId,
                refundId: refund.id,
                ...(refund.vendorOrderId
                    ? { vendorOrderId: refund.vendorOrderId }
                    : {}),
            },
        });
        // Stripe returns "pending" for rails that settle asynchronously; only
        // "succeeded" means the money is actually on its way back.
        const status = stripeRefund.status === "succeeded"
            ? prisma_client_1.RefundStatus.SUCCEEDED
            : stripeRefund.status === "failed" ||
                stripeRefund.status === "canceled"
                ? prisma_client_1.RefundStatus.FAILED
                : prisma_client_1.RefundStatus.PROCESSING;
        await db_1.prisma.refund.update({
            where: { id: refundId },
            data: {
                status,
                gatewayRefundId: stripeRefund.id,
                currency: stripeRefund.currency ?? refund.currency,
                gatewayResponse: stripeRefund,
                processedAt: status === prisma_client_1.RefundStatus.SUCCEEDED ? new Date() : null,
                failureReason: status === prisma_client_1.RefundStatus.FAILED
                    ? (stripeRefund.failure_reason ??
                        "Gateway reported the refund as failed")
                    : null,
            },
        });
        await recomputePaymentRefundState(refund.paymentId);
        console.log(`Refund ${refundId} -> ${status} (stripe ${stripeRefund.id})`);
    }
    catch (error) {
        const failureReason = error instanceof Error ? error.message : "Unknown gateway error";
        await db_1.prisma.refund.update({
            where: { id: refundId },
            data: { status: prisma_client_1.RefundStatus.FAILED, failureReason },
        });
        console.error(`Refund ${refundId} failed: ${failureReason}`);
        if (options.throwOnError) {
            throw new customError_1.default(502, `Refund failed: ${failureReason}`);
        }
    }
    return db_1.prisma.refund.findUniqueOrThrow({ where: { id: refundId } });
}
/**
 * Record money returned outside the gateway — cash handed back for a COD
 * order, or a bank transfer done by hand. No gateway call: the money has
 * already moved, so this is SUCCEEDED on arrival.
 */
async function recordManualRefund(params) {
    const order = await db_1.prisma.order.findUnique({
        where: { id: params.orderId },
        include: { payment: true },
    });
    if (!order?.payment) {
        throw new customError_1.default(404, "Order or payment not found");
    }
    // Only money that was actually collected can be handed back. An unpaid COD
    // order would otherwise be "refunded" and its payment flipped to REFUNDED.
    if (!wasCollected(order.paymentStatus, order.payment.status)) {
        throw new customError_1.default(400, `Nothing to refund: this order's payment is ${order.payment.status}`);
    }
    const alreadyRefunded = await sumSucceededRefunds(db_1.prisma, order.payment.id);
    const refundable = (0, money_1.round2)((0, money_1.toNumber)(order.payment.amount) - alreadyRefunded);
    if (params.amount > refundable + 0.005) {
        throw new customError_1.default(400, `Cannot refund ${params.amount}: only ${refundable} of this payment is unrefunded`);
    }
    if (params.vendorOrderId) {
        // A parcel id from another order would attach this refund to the
        // wrong parcel and block that parcel's own refund (the column is unique).
        const parcel = await db_1.prisma.vendorOrder.findFirst({
            where: { id: params.vendorOrderId, orderId: params.orderId },
            select: { id: true },
        });
        if (!parcel) {
            throw new customError_1.default(404, "That parcel is not part of this order");
        }
        const existing = await db_1.prisma.refund.findUnique({
            where: { vendorOrderId: params.vendorOrderId },
        });
        if (existing) {
            throw new customError_1.default(409, "This parcel already has a refund recorded");
        }
    }
    const refund = await db_1.prisma.refund.create({
        data: {
            orderId: params.orderId,
            paymentId: order.payment.id,
            vendorOrderId: params.vendorOrderId,
            amount: (0, money_1.round2)(params.amount),
            status: prisma_client_1.RefundStatus.SUCCEEDED,
            reason: params.reason,
            // No gateway involved — that is what distinguishes this from a
            // Stripe refund in the ledger.
            gateway: params.method ?? null,
            idempotencyKey: `manual:${params.orderId}:${Date.now()}`,
            processedAt: new Date(),
        },
    });
    await recomputePaymentRefundState(order.payment.id);
    return refund;
}
/** An operator abandons a refund that should not be paid. */
async function cancelRefund(refundId, reason) {
    const refund = await db_1.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund)
        throw new customError_1.default(404, "Refund not found");
    if (refund.status === prisma_client_1.RefundStatus.SUCCEEDED) {
        throw new customError_1.default(400, "This refund already succeeded — reverse it at the gateway instead");
    }
    const canceled = await db_1.prisma.refund.update({
        where: { id: refundId },
        data: { status: prisma_client_1.RefundStatus.CANCELED, failureReason: reason },
    });
    await recomputePaymentRefundState(refund.paymentId);
    return canceled;
}
/**
 * Recompute `Payment.refundAmount` / `refundedAt` / `status` from the refund
 * ledger.
 *
 * `refundAmount` means **actually refunded** — the sum of SUCCEEDED refunds.
 * Nothing else may write it, otherwise the ledger and the summary drift.
 *
 * Payment status follows the money, not the parcels:
 *   - fully refunded            -> REFUNDED
 *   - some refunded             -> PARTIALLY_REFUNDED
 *   - all parcels cancelled but
 *     nothing refunded yet      -> left as-is, so a stuck refund stays visible
 */
async function recomputePaymentRefundState(paymentId) {
    const payment = await db_1.prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
            refunds: true,
            order: { include: { vendorOrders: true } },
        },
    });
    if (!payment)
        return;
    const refunded = (0, money_1.round2)(payment.refunds
        .filter((refund) => refund.status === prisma_client_1.RefundStatus.SUCCEEDED)
        .reduce((total, refund) => total + (0, money_1.toNumber)(refund.amount), 0));
    const charged = (0, money_1.toNumber)(payment.amount);
    const wasPaid = payment.status === prisma_client_1.PaymentStatus.PAID ||
        payment.status === prisma_client_1.PaymentStatus.PARTIALLY_REFUNDED ||
        payment.status === prisma_client_1.PaymentStatus.REFUNDED;
    let status = payment.status;
    if (wasPaid && refunded > 0) {
        status =
            refunded >= charged - 0.005
                ? prisma_client_1.PaymentStatus.REFUNDED
                : prisma_client_1.PaymentStatus.PARTIALLY_REFUNDED;
    }
    await db_1.prisma.payment.update({
        where: { id: paymentId },
        data: {
            status,
            refundAmount: refunded > 0 ? refunded : null,
            refundedAt: refunded > 0 ? (payment.refundedAt ?? new Date()) : null,
        },
    });
    if (status !== payment.order.paymentStatus) {
        await db_1.prisma.order.update({
            where: { id: payment.orderId },
            data: { paymentStatus: status },
        });
    }
}
/**
 * Retry every refund that is owed but not settled.
 *
 * This is the safety net for phase 2 never running — a crash between the
 * cancel commit and the gateway call, or Stripe being down. Nothing schedules
 * it yet; call it from a cron/worker, or an admin can trigger it.
 */
async function processPendingRefunds(limit = 25) {
    const pending = await db_1.prisma.refund.findMany({
        where: {
            status: { in: RETRYABLE },
            gateway: "stripe",
        },
        orderBy: { createdAt: "asc" },
        take: limit,
        select: { id: true },
    });
    const results = { attempted: 0, succeeded: 0, failed: 0 };
    for (const refund of pending) {
        results.attempted++;
        const processed = await processRefund(refund.id);
        if (processed.status === prisma_client_1.RefundStatus.SUCCEEDED)
            results.succeeded++;
        else
            results.failed++;
    }
    return results;
}
/**
 * Stripe's refund status, mapped to ours. One definition, shared by the webhook
 * (`handleRefundEvent`) and the reconciliation sweep below — two copies would
 * be two chances to disagree about what "canceled" means.
 *
 * `canceled` maps to FAILED, not CANCELED: our `RefundStatus.CANCELED` means an
 * operator abandoned the refund and no money moved, whereas a gateway-cancelled
 * refund is money that was owed and did not arrive. It belongs in the failure
 * queue.
 */
const mapStripeRefundStatus = (status) => {
    if (status === "succeeded")
        return prisma_client_1.RefundStatus.SUCCEEDED;
    if (status === "failed" || status === "canceled")
        return prisma_client_1.RefundStatus.FAILED;
    return prisma_client_1.RefundStatus.PROCESSING;
};
exports.mapStripeRefundStatus = mapStripeRefundStatus;
/**
 * Poll refunds stuck in PROCESSING and settle them from the gateway's view.
 *
 * `processPendingRefunds` deliberately does not touch these — PENDING and
 * FAILED are safe to re-send, but a PROCESSING refund is already in flight and
 * re-sending it would be a second refund attempt. Normally the `refund.updated`
 * webhook finishes the story; this exists for when that webhook is missing or
 * was dropped, which is the documented failure mode that leaves a refund
 * PROCESSING forever.
 *
 * Read-only against Stripe (`retrieveStripeRefund`), so it can never move money.
 */
async function reconcileProcessingRefunds(limit = 25) {
    const stuck = await db_1.prisma.refund.findMany({
        where: {
            status: prisma_client_1.RefundStatus.PROCESSING,
            gateway: "stripe",
            gatewayRefundId: { not: null },
        },
        orderBy: { createdAt: "asc" },
        take: limit,
        select: { id: true, gatewayRefundId: true, paymentId: true },
    });
    const results = { checked: 0, settled: 0, stillPending: 0, errored: 0 };
    for (const refund of stuck) {
        results.checked++;
        try {
            const gatewayRefund = await (0, stripe_1.retrieveStripeRefund)(refund.gatewayRefundId);
            const status = (0, exports.mapStripeRefundStatus)(gatewayRefund.status);
            if (status === prisma_client_1.RefundStatus.PROCESSING) {
                results.stillPending++;
                continue;
            }
            await db_1.prisma.refund.update({
                where: { id: refund.id },
                data: {
                    status,
                    gatewayResponse: gatewayRefund,
                    processedAt: status === prisma_client_1.RefundStatus.SUCCEEDED ? new Date() : null,
                    failureReason: status === prisma_client_1.RefundStatus.FAILED
                        ? (gatewayRefund.failure_reason ??
                            "Gateway reported the refund as failed")
                        : null,
                },
            });
            await recomputePaymentRefundState(refund.paymentId);
            results.settled++;
        }
        catch (error) {
            // One unreachable refund must not abort the rest of the sweep.
            results.errored++;
            console.error(`[refunds] could not reconcile ${refund.id}:`, error instanceof Error ? error.message : error);
        }
    }
    return results;
}
/**
 * What the buyer is owed for cancelled parcels, minus what has already been
 * refunded. Derived rather than stored, so it cannot drift.
 */
async function outstandingRefundForOrder(orderId) {
    const order = await db_1.prisma.order.findUnique({
        where: { id: orderId },
        include: { vendorOrders: true, payment: { include: { refunds: true } } },
    });
    if (!order?.payment)
        return 0;
    const owed = (0, money_1.round2)(order.vendorOrders
        .filter((slice) => slice.orderStatus === prisma_client_1.OrderStatus.CANCELED)
        .reduce((total, slice) => total + (0, money_1.toNumber)(slice.totalAmount), 0));
    const refunded = (0, money_1.round2)(order.payment.refunds
        .filter((refund) => refund.status === prisma_client_1.RefundStatus.SUCCEEDED)
        .reduce((total, refund) => total + (0, money_1.toNumber)(refund.amount), 0));
    return (0, money_1.round2)(Math.max(owed - refunded, 0));
}
/** Sum of settled refunds against one payment. */
async function sumSucceededRefunds(client, paymentId) {
    const result = await client.refund.aggregate({
        where: { paymentId, status: prisma_client_1.RefundStatus.SUCCEEDED },
        _sum: { amount: true },
    });
    return (0, money_1.round2)((0, money_1.toNumber)(result._sum.amount));
}
