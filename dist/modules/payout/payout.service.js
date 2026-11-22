"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.payoutServices = void 0;
const prisma_client_1 = require("../../lib/prisma-client.js");
const db_1 = require("../../config/db.js");
const money_1 = require("../../helpers/money.js");
const vendor_1 = require("../../helpers/vendor.js");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder.js"));
const customError_1 = __importDefault(require("../../utils/customError.js"));
const notifications_1 = require("../../helpers/notifications.js");
/**
 * Vendor payouts.
 *
 * The platform takes one charge from the buyer and owes each vendor their
 * `vendorEarning`. A payout is a batch of those earnings settled in one
 * transfer.
 *
 * Idempotency comes from `VendorOrder.payoutId`: a vendor order is only
 * eligible while that column is null, and attaching it happens in the same
 * transaction that creates the payout. Running the same period twice therefore
 * yields nothing the second time rather than paying a vendor twice.
 */
/** A vendor order is settleable once it is delivered and the buyer has paid. */
const eligibleWhere = (vendorId, periodStart, periodEnd) => ({
    vendorId,
    payoutId: null,
    orderStatus: prisma_client_1.OrderStatus.DELIVERED,
    order: { paymentStatus: prisma_client_1.PaymentStatus.PAID },
    ...(periodStart && periodEnd
        ? { deliveredAt: { gte: periodStart, lte: periodEnd } }
        : {}),
});
/**
 * What a vendor is owed right now but has not been paid — the "pending
 * balance" on the vendor dashboard.
 */
const getMyBalance = async (actor, vendorIdOverride) => {
    const vendorId = actor.role === prisma_client_1.Role.ADMIN && vendorIdOverride
        ? vendorIdOverride
        : (await (0, vendor_1.requireApprovedVendor)(actor.id)).id;
    const [pending, inFlight, settled] = await Promise.all([
        db_1.prisma.vendorOrder.aggregate({
            where: eligibleWhere(vendorId),
            _sum: { vendorEarning: true, commissionAmount: true },
            _count: { id: true },
        }),
        // Earned but not yet deliverable — money still tied up in fulfilment.
        db_1.prisma.vendorOrder.aggregate({
            where: {
                vendorId,
                payoutId: null,
                orderStatus: {
                    notIn: [prisma_client_1.OrderStatus.DELIVERED, prisma_client_1.OrderStatus.CANCELED],
                },
                order: { paymentStatus: prisma_client_1.PaymentStatus.PAID },
            },
            _sum: { vendorEarning: true },
            _count: { id: true },
        }),
        db_1.prisma.payout.aggregate({
            where: { vendorId, status: prisma_client_1.PayoutStatus.PAID },
            _sum: { amount: true },
            _count: { id: true },
        }),
    ]);
    return {
        vendorId,
        availableForPayout: (0, money_1.toNumber)(pending._sum.vendorEarning),
        availableOrderCount: pending._count.id,
        commissionWithheld: (0, money_1.toNumber)(pending._sum.commissionAmount),
        pendingFulfilment: (0, money_1.toNumber)(inFlight._sum.vendorEarning),
        pendingFulfilmentOrderCount: inFlight._count.id,
        totalPaidOut: (0, money_1.toNumber)(settled._sum.amount),
        payoutCount: settled._count.id,
    };
};
/**
 * Create a payout run for one vendor.
 *
 * Attaching the vendor orders inside the transaction is what makes this safe
 * to re-run: the `payoutId: null` guard in the update means a concurrent run
 * cannot claim the same earnings.
 */
const generatePayout = async (payload) => {
    const vendor = await db_1.prisma.vendor.findFirst({
        where: { id: payload.vendorId, isDeleted: false },
    });
    if (!vendor) {
        throw new customError_1.default(404, "Vendor not found");
    }
    return db_1.prisma.$transaction(async (tx) => {
        const eligible = await tx.vendorOrder.findMany({
            where: eligibleWhere(payload.vendorId, payload.periodStart, payload.periodEnd),
            select: { id: true, vendorEarning: true },
        });
        if (eligible.length === 0) {
            throw new customError_1.default(400, "No settleable earnings for this vendor in that period");
        }
        const amount = (0, money_1.round2)(eligible.reduce((total, order) => total + (0, money_1.toNumber)(order.vendorEarning), 0));
        const payout = await tx.payout.create({
            data: {
                vendorId: payload.vendorId,
                amount,
                status: prisma_client_1.PayoutStatus.PENDING,
                method: payload.method,
                notes: payload.notes,
                // Snapshot where the money is meant to go, so a later change
                // to the vendor's bank details cannot rewrite history.
                payoutDetails: vendor.payoutDetails ??
                    prisma_client_1.Prisma.JsonNull,
                periodStart: payload.periodStart,
                periodEnd: payload.periodEnd,
            },
        });
        const claimed = await tx.vendorOrder.updateMany({
            where: {
                id: { in: eligible.map((order) => order.id) },
                payoutId: null,
            },
            data: { payoutId: payout.id },
        });
        // A concurrent run took some of these — refuse rather than pay a
        // partial amount that does not match the attached orders.
        if (claimed.count !== eligible.length) {
            throw new customError_1.default(409, "Some earnings were claimed by another payout run. Try again.");
        }
        return tx.payout.findUniqueOrThrow({
            where: { id: payout.id },
            include: {
                vendor: { select: { id: true, storeName: true, slug: true } },
                _count: { select: { vendorOrders: true } },
            },
        });
    });
};
const markPaid = async (payoutId, payload) => {
    const payout = await db_1.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) {
        throw new customError_1.default(404, "Payout not found");
    }
    if (payout.status === prisma_client_1.PayoutStatus.PAID) {
        throw new customError_1.default(400, "This payout is already marked as paid");
    }
    const paid = await db_1.prisma.payout.update({
        where: { id: payoutId },
        data: {
            status: prisma_client_1.PayoutStatus.PAID,
            reference: payload.reference,
            method: payload.method ?? payout.method,
            notes: payload.notes ?? payout.notes,
            failureReason: null,
            processedAt: new Date(),
        },
    });
    await (0, notifications_1.notifyPayoutPaid)(payoutId);
    return paid;
};
/**
 * Settlement failed at the bank. The attached earnings are released back to
 * the pool so the next run can pick them up.
 */
const markFailed = async (payoutId, payload) => {
    const payout = await db_1.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) {
        throw new customError_1.default(404, "Payout not found");
    }
    if (payout.status === prisma_client_1.PayoutStatus.PAID) {
        throw new customError_1.default(400, "This payout is already paid. Reverse it at the gateway first.");
    }
    return db_1.prisma.$transaction(async (tx) => {
        await tx.vendorOrder.updateMany({
            where: { payoutId },
            data: { payoutId: null },
        });
        return tx.payout.update({
            where: { id: payoutId },
            data: {
                status: prisma_client_1.PayoutStatus.FAILED,
                failureReason: payload.failureReason,
                processedAt: new Date(),
            },
        });
    });
};
/** The vendor's own payout history. */
const getMyPayouts = async (actor, query) => {
    const vendorId = actor.role === prisma_client_1.Role.ADMIN && query.vendorId
        ? String(query.vendorId)
        : (await (0, vendor_1.requireApprovedVendor)(actor.id)).id;
    const { vendorId: _ignored, ...rest } = query;
    const builder = new PrismaQueryBuilder_1.default(rest, { model: "Payout" });
    const prismaArgs = builder
        .withDefaultFilter({ vendorId })
        // The bank / gateway reference is what a seller has on a statement.
        .search(["reference", "method", "notes"])
        .filter()
        .paginate()
        .sort("createdAt", "desc")
        .include({
        _count: { select: { vendorOrders: true } },
    })
        .build();
    const [payouts, meta] = await Promise.all([
        db_1.prisma.payout.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.payout),
    ]);
    // Bank details are the platform's record, not something to echo back.
    return {
        meta,
        data: payouts.map(({ payoutDetails: _hidden, ...payout }) => payout),
    };
};
/** Every payout across all vendors. ADMIN only. */
const findAllForAdmin = async (query) => {
    const builder = new PrismaQueryBuilder_1.default(query, { model: "Payout" });
    const prismaArgs = builder
        .search(["reference", "method", "notes"], ["vendor.storeName"])
        .filter()
        .paginate()
        .sort("createdAt", "desc")
        .include({
        vendor: {
            select: {
                id: true,
                storeName: true,
                slug: true,
                businessEmail: true,
            },
        },
        _count: { select: { vendorOrders: true } },
    })
        .build();
    const [payouts, meta] = await Promise.all([
        db_1.prisma.payout.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.payout),
    ]);
    return { meta, data: payouts };
};
/**
 * One payout with the orders it settles. A vendor may only open their own.
 */
const findById = async (actor, payoutId) => {
    const payout = await db_1.prisma.payout.findUnique({
        where: { id: payoutId },
        include: {
            vendor: { select: { id: true, storeName: true, slug: true } },
            vendorOrders: {
                select: {
                    id: true,
                    vendorOrderNumber: true,
                    subtotal: true,
                    shippingCost: true,
                    commissionAmount: true,
                    vendorEarning: true,
                    deliveredAt: true,
                    order: { select: { orderNumber: true } },
                },
            },
        },
    });
    if (!payout) {
        throw new customError_1.default(404, "Payout not found");
    }
    if (actor.role !== prisma_client_1.Role.ADMIN) {
        const vendor = await (0, vendor_1.requireApprovedVendor)(actor.id);
        if (payout.vendorId !== vendor.id) {
            throw new customError_1.default(404, "Payout not found");
        }
        const { payoutDetails: _hidden, ...safe } = payout;
        return safe;
    }
    return payout;
};
/**
 * Admin overview: who is owed what right now, across every approved store.
 * This is the queue an operator works through when running settlements.
 */
const getOutstandingBalances = async () => {
    const grouped = await db_1.prisma.vendorOrder.groupBy({
        by: ["vendorId"],
        where: {
            payoutId: null,
            orderStatus: prisma_client_1.OrderStatus.DELIVERED,
            order: { paymentStatus: prisma_client_1.PaymentStatus.PAID },
        },
        _sum: { vendorEarning: true, commissionAmount: true },
        _count: { id: true },
    });
    if (grouped.length === 0) {
        return { totalOwed: 0, vendors: [] };
    }
    const vendors = await db_1.prisma.vendor.findMany({
        where: { id: { in: grouped.map((row) => row.vendorId) } },
        select: {
            id: true,
            storeName: true,
            slug: true,
            businessEmail: true,
            status: true,
        },
    });
    const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
    const rows = grouped
        .map((row) => ({
        vendorId: row.vendorId,
        storeName: vendorById.get(row.vendorId)?.storeName ?? null,
        slug: vendorById.get(row.vendorId)?.slug ?? null,
        businessEmail: vendorById.get(row.vendorId)?.businessEmail ?? null,
        vendorStatus: vendorById.get(row.vendorId)?.status ?? null,
        orderCount: row._count.id,
        amountOwed: (0, money_1.toNumber)(row._sum.vendorEarning),
        commissionEarned: (0, money_1.toNumber)(row._sum.commissionAmount),
    }))
        .sort((a, b) => b.amountOwed - a.amountOwed);
    return {
        totalOwed: (0, money_1.round2)(rows.reduce((total, row) => total + row.amountOwed, 0)),
        vendors: rows,
    };
};
exports.payoutServices = {
    getMyBalance,
    getMyPayouts,
    findById,
    //
    generatePayout,
    markPaid,
    markFailed,
    findAllForAdmin,
    getOutstandingBalances,
};
