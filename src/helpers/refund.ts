/* eslint-disable no-console */
import {
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    Prisma,
    RefundStatus,
} from "@/lib/prisma-client";
import { prisma } from "@/config/db";
import CustomError from "@/utils/customError";
import { round2, toNumber } from "./money";
import { createStripeRefund } from "./stripe";

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
const RETRYABLE: RefundStatus[] = [RefundStatus.PENDING, RefundStatus.FAILED];

/**
 * Derives the Stripe idempotency key for one attempt.
 *
 * Keyed on the refund row AND the attempt number: an accidental replay of the
 * same attempt reuses the key (Stripe replays its stored response instead of
 * refunding again), while a deliberate retry after a failure gets a fresh key
 * and is a genuinely new request.
 */
const idempotencyKeyFor = (refundId: string, attempt: number) =>
    `refund:${refundId}:${attempt}`;

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
export async function recordRefundIntent(
    tx: Prisma.TransactionClient,
    params: {
        orderId: string;
        vendorOrderId: string;
        amount: number;
        reason?: string;
    },
): Promise<string | null> {
    if (params.amount <= 0) return null;

    const order = await tx.order.findUnique({
        where: { id: params.orderId },
        include: { payment: true },
    });

    if (!order?.payment) return null;

    // Nothing was ever collected, so there is nothing to give back.
    const wasPaid =
        order.paymentStatus === PaymentStatus.PAID ||
        order.paymentStatus === PaymentStatus.PARTIALLY_REFUNDED ||
        order.payment.status === PaymentStatus.PAID ||
        order.payment.status === PaymentStatus.PARTIALLY_REFUNDED;

    if (!wasPaid) return null;

    // Cash on delivery has no gateway to call. The money, if any changed
    // hands, is returned in person — an admin records that separately with
    // `recordManualRefund`.
    if (order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY) return null;

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
    const refundable = round2(
        toNumber(order.payment.amount) - alreadyRefunded,
    );

    if (refundable <= 0) return null;

    const amount = round2(Math.min(params.amount, refundable));
    if (amount <= 0) return null;

    const refund = await tx.refund.create({
        data: {
            orderId: params.orderId,
            paymentId: order.payment.id,
            vendorOrderId: params.vendorOrderId,
            amount,
            status: RefundStatus.PENDING,
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
export async function processRefund(
    refundId: string,
    options: { throwOnError?: boolean } = {},
) {
    const refund = await prisma.refund.findUnique({
        where: { id: refundId },
        include: { payment: true },
    });

    if (!refund) {
        throw new CustomError(404, "Refund not found");
    }

    if (refund.status === RefundStatus.SUCCEEDED) {
        return refund;
    }

    if (refund.status === RefundStatus.CANCELED) {
        throw new CustomError(400, "This refund was cancelled");
    }

    const paymentIntentId = refund.payment.transactionId;

    if (!paymentIntentId) {
        // A paid Stripe order always has one; without it we cannot identify
        // the charge, so this needs a human.
        const message =
            "No gateway transaction on this payment — refund it manually at the gateway";
        await prisma.refund.update({
            where: { id: refundId },
            data: { status: RefundStatus.FAILED, failureReason: message },
        });

        if (options.throwOnError) throw new CustomError(422, message);
        console.error(`Refund ${refundId}: ${message}`);
        return prisma.refund.findUniqueOrThrow({ where: { id: refundId } });
    }

    const attempt = refund.attempts + 1;
    const idempotencyKey = idempotencyKeyFor(refund.id, attempt);

    // Claim the attempt before the call, so a crash mid-flight leaves a
    // PROCESSING row an operator can reconcile rather than a silent PENDING
    // one that gets retried with a different key.
    await prisma.refund.update({
        where: { id: refundId },
        data: {
            status: RefundStatus.PROCESSING,
            attempts: attempt,
            idempotencyKey,
            failureReason: null,
        },
    });

    try {
        const stripeRefund = await createStripeRefund({
            paymentIntentId,
            amount: toNumber(refund.amount),
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
        const status =
            stripeRefund.status === "succeeded"
                ? RefundStatus.SUCCEEDED
                : stripeRefund.status === "failed" ||
                    stripeRefund.status === "canceled"
                  ? RefundStatus.FAILED
                  : RefundStatus.PROCESSING;

        await prisma.refund.update({
            where: { id: refundId },
            data: {
                status,
                gatewayRefundId: stripeRefund.id,
                currency: stripeRefund.currency ?? refund.currency,
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

        await recomputePaymentRefundState(refund.paymentId);

        console.log(
            `Refund ${refundId} -> ${status} (stripe ${stripeRefund.id})`,
        );
    } catch (error) {
        const failureReason =
            error instanceof Error ? error.message : "Unknown gateway error";

        await prisma.refund.update({
            where: { id: refundId },
            data: { status: RefundStatus.FAILED, failureReason },
        });

        console.error(`Refund ${refundId} failed: ${failureReason}`);

        if (options.throwOnError) {
            throw new CustomError(502, `Refund failed: ${failureReason}`);
        }
    }

    return prisma.refund.findUniqueOrThrow({ where: { id: refundId } });
}

/**
 * Record money returned outside the gateway — cash handed back for a COD
 * order, or a bank transfer done by hand. No gateway call: the money has
 * already moved, so this is SUCCEEDED on arrival.
 */
export async function recordManualRefund(params: {
    orderId: string;
    amount: number;
    reason: string;
    vendorOrderId?: string;
    method?: string;
}) {
    const order = await prisma.order.findUnique({
        where: { id: params.orderId },
        include: { payment: true },
    });

    if (!order?.payment) {
        throw new CustomError(404, "Order or payment not found");
    }

    const alreadyRefunded = await sumSucceededRefunds(
        prisma,
        order.payment.id,
    );
    const refundable = round2(
        toNumber(order.payment.amount) - alreadyRefunded,
    );

    if (params.amount > refundable + 0.005) {
        throw new CustomError(
            400,
            `Cannot refund ${params.amount}: only ${refundable} of this payment is unrefunded`,
        );
    }

    if (params.vendorOrderId) {
        const existing = await prisma.refund.findUnique({
            where: { vendorOrderId: params.vendorOrderId },
        });

        if (existing) {
            throw new CustomError(
                409,
                "This parcel already has a refund recorded",
            );
        }
    }

    const refund = await prisma.refund.create({
        data: {
            orderId: params.orderId,
            paymentId: order.payment.id,
            vendorOrderId: params.vendorOrderId,
            amount: round2(params.amount),
            status: RefundStatus.SUCCEEDED,
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
export async function cancelRefund(refundId: string, reason: string) {
    const refund = await prisma.refund.findUnique({ where: { id: refundId } });

    if (!refund) throw new CustomError(404, "Refund not found");

    if (refund.status === RefundStatus.SUCCEEDED) {
        throw new CustomError(
            400,
            "This refund already succeeded — reverse it at the gateway instead",
        );
    }

    const canceled = await prisma.refund.update({
        where: { id: refundId },
        data: { status: RefundStatus.CANCELED, failureReason: reason },
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
export async function recomputePaymentRefundState(paymentId: string) {
    const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
            refunds: true,
            order: { include: { vendorOrders: true } },
        },
    });

    if (!payment) return;

    const refunded = round2(
        payment.refunds
            .filter((refund) => refund.status === RefundStatus.SUCCEEDED)
            .reduce((total, refund) => total + toNumber(refund.amount), 0),
    );

    const charged = toNumber(payment.amount);
    const wasPaid =
        payment.status === PaymentStatus.PAID ||
        payment.status === PaymentStatus.PARTIALLY_REFUNDED ||
        payment.status === PaymentStatus.REFUNDED;

    let status = payment.status;

    if (wasPaid && refunded > 0) {
        status =
            refunded >= charged - 0.005
                ? PaymentStatus.REFUNDED
                : PaymentStatus.PARTIALLY_REFUNDED;
    }

    await prisma.payment.update({
        where: { id: paymentId },
        data: {
            status,
            refundAmount: refunded > 0 ? refunded : null,
            refundedAt:
                refunded > 0 ? (payment.refundedAt ?? new Date()) : null,
        },
    });

    if (status !== payment.order.paymentStatus) {
        await prisma.order.update({
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
export async function processPendingRefunds(limit = 25) {
    const pending = await prisma.refund.findMany({
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
        if (processed.status === RefundStatus.SUCCEEDED) results.succeeded++;
        else results.failed++;
    }

    return results;
}

/**
 * What the buyer is owed for cancelled parcels, minus what has already been
 * refunded. Derived rather than stored, so it cannot drift.
 */
export async function outstandingRefundForOrder(orderId: string) {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { vendorOrders: true, payment: { include: { refunds: true } } },
    });

    if (!order?.payment) return 0;

    const owed = round2(
        order.vendorOrders
            .filter((slice) => slice.orderStatus === OrderStatus.CANCELED)
            .reduce((total, slice) => total + toNumber(slice.totalAmount), 0),
    );

    const refunded = round2(
        order.payment.refunds
            .filter((refund) => refund.status === RefundStatus.SUCCEEDED)
            .reduce((total, refund) => total + toNumber(refund.amount), 0),
    );

    return round2(Math.max(owed - refunded, 0));
}

/** Sum of settled refunds against one payment. */
async function sumSucceededRefunds(
    client: Prisma.TransactionClient | typeof prisma,
    paymentId: string,
): Promise<number> {
    const result = await client.refund.aggregate({
        where: { paymentId, status: RefundStatus.SUCCEEDED },
        _sum: { amount: true },
    });

    return round2(toNumber(result._sum.amount));
}
