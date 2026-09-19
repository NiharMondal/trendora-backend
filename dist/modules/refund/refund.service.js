"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refundServices = void 0;
const prisma_1 = require("../../../generated/prisma");
const db_1 = require("../../config/db");
const money_1 = require("../../helpers/money");
const refund_1 = require("../../helpers/refund");
const vendor_1 = require("../../helpers/vendor");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder"));
const customError_1 = __importDefault(require("../../utils/customError"));
/**
 * Refund administration.
 *
 * The refund itself is issued automatically when a paid parcel is cancelled
 * (see order.service). These endpoints exist for the cases automation cannot
 * close: a gateway failure that needs retrying, money returned by hand, and an
 * operator abandoning a refund that should not be paid.
 */
/** Every refund, for the admin queue. `?status=FAILED` narrows it. */
const findAllForAdmin = async (query) => {
    const builder = new PrismaQueryBuilder_1.default(query);
    const prismaArgs = builder
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
        db_1.prisma.refund.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.refund),
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
    const stuck = await db_1.prisma.refund.findMany({
        where: {
            status: {
                in: [
                    prisma_1.RefundStatus.PENDING,
                    prisma_1.RefundStatus.PROCESSING,
                    prisma_1.RefundStatus.FAILED,
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
    const byStatus = await db_1.prisma.refund.groupBy({
        by: ["status"],
        _sum: { amount: true },
        _count: { id: true },
    });
    return {
        totalOutstanding: stuck.reduce((total, refund) => total + (0, money_1.toNumber)(refund.amount), 0),
        outstandingCount: stuck.length,
        byStatus: byStatus.map((row) => ({
            status: row.status,
            count: row._count.id,
            amount: (0, money_1.toNumber)(row._sum.amount),
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
const findMine = async (actor, query) => {
    let scope;
    if (actor.role === prisma_1.Role.VENDOR) {
        const vendor = await (0, vendor_1.requireApprovedVendor)(actor.id);
        scope = { vendorOrder: { vendorId: vendor.id } };
    }
    else {
        scope = { order: { userId: actor.id } };
    }
    const builder = new PrismaQueryBuilder_1.default(query);
    const prismaArgs = builder
        .withDefaultFilter(scope)
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
        db_1.prisma.refund.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.refund),
    ]);
    // The raw gateway payload is an internal record, not something to hand to
    // a buyer or a seller.
    return {
        meta,
        data: refunds.map(({ gatewayResponse: _hidden, ...refund }) => refund),
    };
};
const findById = async (refundId) => {
    const refund = await db_1.prisma.refund.findUnique({
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
        throw new customError_1.default(404, "Refund not found");
    }
    return refund;
};
/**
 * Retry one refund at the gateway.
 *
 * Unlike the automatic path this DOES surface a gateway failure to the caller —
 * an operator pressing "retry" needs to see what went wrong.
 */
const retry = async (refundId) => (0, refund_1.processRefund)(refundId, { throwOnError: true });
/** Retry everything owed. The safety net for a missed gateway call. */
const retryAll = async () => (0, refund_1.processPendingRefunds)();
const manual = async (payload) => (0, refund_1.recordManualRefund)({
    orderId: payload.orderId,
    vendorOrderId: payload.vendorOrderId,
    amount: payload.amount,
    reason: payload.reason,
    method: payload.method ?? "manual",
});
const cancel = async (refundId, payload) => (0, refund_1.cancelRefund)(refundId, payload.reason);
exports.refundServices = {
    findAllForAdmin,
    getOutstanding,
    findMine,
    findById,
    retry,
    retryAll,
    manual,
    cancel,
};
