import {
    OrderStatus,
    PaymentStatus,
    PayoutStatus,
    Prisma,
    Role,
} from "@/lib/prisma-client";
import { prisma } from "@/config/db";
import { round2, toNumber } from "@/helpers/money";
import { requireApprovedVendor } from "@/helpers/vendor";
import PrismaQueryBuilder from "@/lib/PrismaQueryBuilder";
import CustomError from "@/utils/customError";
import {
    TGeneratePayout,
    TMarkPayoutFailed,
    TMarkPayoutPaid,
} from "./payout.validation";

type TActor = { id: string; role: string };

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
const eligibleWhere = (
    vendorId: string,
    periodStart?: Date,
    periodEnd?: Date,
): Prisma.VendorOrderWhereInput => ({
    vendorId,
    payoutId: null,
    orderStatus: OrderStatus.DELIVERED,
    order: { paymentStatus: PaymentStatus.PAID },
    ...(periodStart && periodEnd
        ? { deliveredAt: { gte: periodStart, lte: periodEnd } }
        : {}),
});

/**
 * What a vendor is owed right now but has not been paid — the "pending
 * balance" on the vendor dashboard.
 */
const getMyBalance = async (actor: TActor, vendorIdOverride?: string) => {
    const vendorId =
        actor.role === Role.ADMIN && vendorIdOverride
            ? vendorIdOverride
            : (await requireApprovedVendor(actor.id)).id;

    const [pending, inFlight, settled] = await Promise.all([
        prisma.vendorOrder.aggregate({
            where: eligibleWhere(vendorId),
            _sum: { vendorEarning: true, commissionAmount: true },
            _count: { id: true },
        }),

        // Earned but not yet deliverable — money still tied up in fulfilment.
        prisma.vendorOrder.aggregate({
            where: {
                vendorId,
                payoutId: null,
                orderStatus: {
                    notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELED],
                },
                order: { paymentStatus: PaymentStatus.PAID },
            },
            _sum: { vendorEarning: true },
            _count: { id: true },
        }),

        prisma.payout.aggregate({
            where: { vendorId, status: PayoutStatus.PAID },
            _sum: { amount: true },
            _count: { id: true },
        }),
    ]);

    return {
        vendorId,
        availableForPayout: toNumber(pending._sum.vendorEarning),
        availableOrderCount: pending._count.id,
        commissionWithheld: toNumber(pending._sum.commissionAmount),
        pendingFulfilment: toNumber(inFlight._sum.vendorEarning),
        pendingFulfilmentOrderCount: inFlight._count.id,
        totalPaidOut: toNumber(settled._sum.amount),
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
const generatePayout = async (payload: TGeneratePayout) => {
    const vendor = await prisma.vendor.findFirst({
        where: { id: payload.vendorId, isDeleted: false },
    });

    if (!vendor) {
        throw new CustomError(404, "Vendor not found");
    }

    return prisma.$transaction(async (tx) => {
        const eligible = await tx.vendorOrder.findMany({
            where: eligibleWhere(
                payload.vendorId,
                payload.periodStart,
                payload.periodEnd,
            ),
            select: { id: true, vendorEarning: true },
        });

        if (eligible.length === 0) {
            throw new CustomError(
                400,
                "No settleable earnings for this vendor in that period",
            );
        }

        const amount = round2(
            eligible.reduce(
                (total, order) => total + toNumber(order.vendorEarning),
                0,
            ),
        );

        const payout = await tx.payout.create({
            data: {
                vendorId: payload.vendorId,
                amount,
                status: PayoutStatus.PENDING,
                method: payload.method,
                notes: payload.notes,
                // Snapshot where the money is meant to go, so a later change
                // to the vendor's bank details cannot rewrite history.
                payoutDetails:
                    (vendor.payoutDetails as Prisma.InputJsonValue) ??
                    Prisma.JsonNull,
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
            throw new CustomError(
                409,
                "Some earnings were claimed by another payout run. Try again.",
            );
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

const markPaid = async (payoutId: string, payload: TMarkPayoutPaid) => {
    const payout = await prisma.payout.findUnique({ where: { id: payoutId } });

    if (!payout) {
        throw new CustomError(404, "Payout not found");
    }

    if (payout.status === PayoutStatus.PAID) {
        throw new CustomError(400, "This payout is already marked as paid");
    }

    return prisma.payout.update({
        where: { id: payoutId },
        data: {
            status: PayoutStatus.PAID,
            reference: payload.reference,
            method: payload.method ?? payout.method,
            notes: payload.notes ?? payout.notes,
            failureReason: null,
            processedAt: new Date(),
        },
    });
};

/**
 * Settlement failed at the bank. The attached earnings are released back to
 * the pool so the next run can pick them up.
 */
const markFailed = async (payoutId: string, payload: TMarkPayoutFailed) => {
    const payout = await prisma.payout.findUnique({ where: { id: payoutId } });

    if (!payout) {
        throw new CustomError(404, "Payout not found");
    }

    if (payout.status === PayoutStatus.PAID) {
        throw new CustomError(
            400,
            "This payout is already paid. Reverse it at the gateway first.",
        );
    }

    return prisma.$transaction(async (tx) => {
        await tx.vendorOrder.updateMany({
            where: { payoutId },
            data: { payoutId: null },
        });

        return tx.payout.update({
            where: { id: payoutId },
            data: {
                status: PayoutStatus.FAILED,
                failureReason: payload.failureReason,
                processedAt: new Date(),
            },
        });
    });
};

/** The vendor's own payout history. */
const getMyPayouts = async (
    actor: TActor,
    query: Record<string, unknown>,
) => {
    const vendorId =
        actor.role === Role.ADMIN && query.vendorId
            ? String(query.vendorId)
            : (await requireApprovedVendor(actor.id)).id;

    const { vendorId: _ignored, ...rest } = query;

    const builder = new PrismaQueryBuilder<Prisma.PayoutWhereInput>(rest);

    const prismaArgs = builder
        .withDefaultFilter({ vendorId })
        .filter()
        .paginate()
        .sort("createdAt", "desc")
        .include({
            _count: { select: { vendorOrders: true } },
        })
        .build();

    const [payouts, meta] = await Promise.all([
        prisma.payout.findMany(prismaArgs),
        builder.getMeta(prisma.payout),
    ]);

    // Bank details are the platform's record, not something to echo back.
    return {
        meta,
        data: payouts.map(({ payoutDetails: _hidden, ...payout }) => payout),
    };
};

/** Every payout across all vendors. ADMIN only. */
const findAllForAdmin = async (query: Record<string, unknown>) => {
    const builder = new PrismaQueryBuilder<Prisma.PayoutWhereInput>(query);

    const prismaArgs = builder
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
        prisma.payout.findMany(prismaArgs),
        builder.getMeta(prisma.payout),
    ]);

    return { meta, data: payouts };
};

/**
 * One payout with the orders it settles. A vendor may only open their own.
 */
const findById = async (actor: TActor, payoutId: string) => {
    const payout = await prisma.payout.findUnique({
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
        throw new CustomError(404, "Payout not found");
    }

    if (actor.role !== Role.ADMIN) {
        const vendor = await requireApprovedVendor(actor.id);

        if (payout.vendorId !== vendor.id) {
            throw new CustomError(404, "Payout not found");
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
    const grouped = await prisma.vendorOrder.groupBy({
        by: ["vendorId"],
        where: {
            payoutId: null,
            orderStatus: OrderStatus.DELIVERED,
            order: { paymentStatus: PaymentStatus.PAID },
        },
        _sum: { vendorEarning: true, commissionAmount: true },
        _count: { id: true },
    });

    if (grouped.length === 0) {
        return { totalOwed: 0, vendors: [] };
    }

    const vendors = await prisma.vendor.findMany({
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
            amountOwed: toNumber(row._sum.vendorEarning),
            commissionEarned: toNumber(row._sum.commissionAmount),
        }))
        .sort((a, b) => b.amountOwed - a.amountOwed);

    return {
        totalOwed: round2(
            rows.reduce((total, row) => total + row.amountOwed, 0),
        ),
        vendors: rows,
    };
};

export const payoutServices = {
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
