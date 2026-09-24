import { Prisma, RefundStatus, Role } from "@/lib/prisma-client";
import { prisma } from "@/config/db";
import { toNumber } from "@/helpers/money";
import {
    cancelRefund,
    processPendingRefunds,
    processRefund,
    recordManualRefund,
} from "@/helpers/refund";
import { requireApprovedVendor } from "@/helpers/vendor";
import PrismaQueryBuilder from "@/lib/PrismaQueryBuilder";
import CustomError from "@/utils/customError";
import { TCancelRefund, TManualRefund } from "./refund.validation";

type TActor = { id: string; role: string };

/**
 * Refund administration.
 *
 * The refund itself is issued automatically when a paid parcel is cancelled
 * (see order.service). These endpoints exist for the cases automation cannot
 * close: a gateway failure that needs retrying, money returned by hand, and an
 * operator abandoning a refund that should not be paid.
 */

/** Every refund, for the admin queue. `?status=FAILED` narrows it. */
const findAllForAdmin = async (query: Record<string, unknown>) => {
    const builder = new PrismaQueryBuilder<Prisma.RefundWhereInput>(query, { model: "Refund" });

    const prismaArgs = builder
        // Order or parcel number, the Stripe refund id (`re_…`, what support
        // is quoted), or the reason / failure text.
        .search(
            ["gatewayRefundId", "reason", "failureReason"],
            ["order.orderNumber", "vendorOrder.vendorOrderNumber"],
        )
        .filter()
        .paginate()
        .sort("createdAt", "desc")
        .include({
            order: {
                select: {
                    id: true,
                    orderNumber: true,
                    paymentMethod: true,
                    paymentStatus: true,
                    user: { select: { id: true, name: true } },
                },
            },
            vendorOrder: {
                select: {
                    id: true,
                    vendorOrderNumber: true,
                    cancelReason: true,
                    vendor: { select: { id: true, storeName: true, slug: true } },
                },
            },
        })
        .build();

    const [refunds, meta] = await Promise.all([
        prisma.refund.findMany(prismaArgs),
        builder.getMeta(prisma.refund),
    ]);

    return { meta, data: refunds };
};

/**
 * Money owed to buyers that has not gone back yet — the work queue.
 *
 * PENDING means it was never sent (a crash, or Stripe was down); FAILED means
 * the gateway rejected it. Both are retryable.
 */
const getOutstanding = async () => {
    const stuck = await prisma.refund.findMany({
        where: {
            status: {
                in: [
                    RefundStatus.PENDING,
                    RefundStatus.PROCESSING,
                    RefundStatus.FAILED,
                ],
            },
        },
        orderBy: { createdAt: "asc" },
        include: {
            order: { select: { id: true, orderNumber: true } },
            vendorOrder: {
                select: {
                    vendorOrderNumber: true,
                    vendor: { select: { storeName: true } },
                },
            },
        },
    });

    const byStatus = await prisma.refund.groupBy({
        by: ["status"],
        _sum: { amount: true },
        _count: { id: true },
    });

    return {
        totalOutstanding: stuck.reduce(
            (total, refund) => total + toNumber(refund.amount),
            0,
        ),
        outstandingCount: stuck.length,
        byStatus: byStatus.map((row) => ({
            status: row.status,
            count: row._count.id,
            amount: toNumber(row._sum.amount),
        })),
        refunds: stuck,
    };
};

/**
 * A buyer's own refunds, and a vendor's view of refunds on their parcels.
 *
 * A vendor sees only refunds tied to their own parcels — never another
 * store's, and never order-level ones.
 */
const findMine = async (actor: TActor, query: Record<string, unknown>) => {
    // A VENDOR is still a shopper, so "my refunds" has two meanings for them:
    // money going back to buyers of their parcels (`seller`, the default for a
    // vendor — unchanged), or money coming back to them on orders they placed
    // (`buyer`, what the shopper dashboard asks for). Without `?as=buyer` a
    // seller could never see a refund on their own purchase.
    const { as, ...rest } = query;
    if (as !== undefined && as !== "buyer" && as !== "seller") {
        throw new CustomError(400, "as must be buyer or seller");
    }

    const perspective =
        as === "buyer" || as === "seller"
            ? as
            : actor.role === Role.VENDOR
              ? "seller"
              : "buyer";

    let scope: Prisma.RefundWhereInput;

    if (perspective === "seller") {
        if (actor.role !== Role.VENDOR) {
            throw new CustomError(403, "Only a seller can list refunds on their parcels");
        }
        const vendor = await requireApprovedVendor(actor.id);
        scope = { vendorOrder: { vendorId: vendor.id } };
    } else {
        scope = { order: { userId: actor.id } };
    }

    const builder = new PrismaQueryBuilder<Prisma.RefundWhereInput>(rest, { model: "Refund" });

    const prismaArgs = builder
        .withDefaultFilter(scope)
        .search(
            ["reason"],
            ["order.orderNumber", "vendorOrder.vendorOrderNumber"],
        )
        .filter()
        .paginate()
        .sort("createdAt", "desc")
        .include({
            order: { select: { id: true, orderNumber: true } },
            vendorOrder: {
                select: {
                    vendorOrderNumber: true,
                    vendor: { select: { storeName: true, slug: true } },
                },
            },
        })
        .build();

    const [refunds, meta] = await Promise.all([
        prisma.refund.findMany(prismaArgs),
        builder.getMeta(prisma.refund),
    ]);

    // The raw gateway payload is an internal record, not something to hand to
    // a buyer or a seller.
    return {
        meta,
        data: refunds.map(({ gatewayResponse: _hidden, ...refund }) => refund),
    };
};

const findById = async (refundId: string) => {
    const refund = await prisma.refund.findUnique({
        where: { id: refundId },
        include: {
            order: {
                select: {
                    id: true,
                    orderNumber: true,
                    totalAmount: true,
                    paymentMethod: true,
                    paymentStatus: true,
                    user: { select: { id: true, name: true } },
                },
            },
            payment: {
                select: {
                    id: true,
                    amount: true,
                    transactionId: true,
                    refundAmount: true,
                },
            },
            vendorOrder: {
                select: {
                    id: true,
                    vendorOrderNumber: true,
                    totalAmount: true,
                    cancelReason: true,
                    vendor: { select: { id: true, storeName: true, slug: true } },
                },
            },
        },
    });

    if (!refund) {
        throw new CustomError(404, "Refund not found");
    }

    return refund;
};

/**
 * Retry one refund at the gateway.
 *
 * Unlike the automatic path this DOES surface a gateway failure to the caller —
 * an operator pressing "retry" needs to see what went wrong.
 */
const retry = async (refundId: string) =>
    processRefund(refundId, { throwOnError: true });

/** Retry everything owed. The safety net for a missed gateway call. */
const retryAll = async () => processPendingRefunds();

const manual = async (payload: TManualRefund) =>
    recordManualRefund({
        orderId: payload.orderId,
        vendorOrderId: payload.vendorOrderId,
        amount: payload.amount,
        reason: payload.reason,
        method: payload.method ?? "manual",
    });

const cancel = async (refundId: string, payload: TCancelRefund) =>
    cancelRefund(refundId, payload.reason);

export const refundServices = {
    findAllForAdmin,
    getOutstanding,
    findMine,
    findById,
    retry,
    retryAll,
    manual,
    cancel,
};
