import {
    OrderStatus,
    PaymentStatus,
    Prisma,
    Role,
    VendorStatus,
} from "@/lib/prisma-client";
import { prisma } from "@/config/db";
import { envConfig } from "@/config/env-config";
import { round2, toNumber } from "@/helpers/money";
import { generateUniqueVendorSlug } from "@/helpers/slug";
import {
    findVendorByOwner,
    logVendorStatusChange,
    publicProductFilter,
    publicVendorSelect,
    requireApprovedVendor,
    sanitizeVendorHistory,
    TModerationActor,
    vendorStatusHistorySelect,
} from "@/helpers/vendor";
import PrismaQueryBuilder from "@/lib/PrismaQueryBuilder";
import { deleteFromCloudinary, moveFromTemp } from "@/utils/cloudinary";
import CustomError from "@/utils/customError";
import { notifyVendorApplicationDecision } from "@/helpers/notifications";
import {
    TRejectVendor,
    TSuspendVendor,
    TUpdateMyStore,
    TUpdateVendorSettings,
    TVendorApply,
} from "./vendor.validation";

/**
 * Promotes a Cloudinary temp upload into its final folder.
 *
 * The frontend uploads straight to `trendora/<folder>/temp/` and sends us
 * `{ url, publicId }`; only assets still in `temp/` are moved, which is the
 * same guard the product service uses to avoid touching a live image.
 */
const promoteImage = async (image?: { url: string; publicId: string }) => {
    if (!image) return undefined;

    if (image.publicId.includes("/temp/")) {
        return moveFromTemp(image.publicId);
    }

    return { url: image.url, publicId: image.publicId };
};

/**
 * A shopper applies to become a seller.
 *
 * The store is created PENDING — it is invisible and cannot list products
 * until an admin approves it, which is also when the account's role is
 * promoted to VENDOR.
 */
const applyForVendor = async (userId: string, payload: TVendorApply) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { auth: true },
    });

    if (!user || user.isDeleted) {
        throw new CustomError(404, "User not found");
    }

    const existing = await prisma.vendor.findFirst({
        where: { ownerId: userId },
    });

    if (existing) {
        // A rejected applicant may re-apply; the same row is reused so the
        // one-store-per-user invariant (Vendor.ownerId is unique) holds.
        if (existing.status === VendorStatus.REJECTED) {
            return reapply(existing.id, userId, payload);
        }

        throw new CustomError(
            409,
            existing.status === VendorStatus.PENDING
                ? "You already have a vendor application under review"
                : "You already have a vendor account",
        );
    }

    const [slug, logo, banner] = await Promise.all([
        generateUniqueVendorSlug(payload.storeName),
        promoteImage(payload.logo),
        promoteImage(payload.banner),
    ]);

    return prisma.$transaction(async (tx) => {
        const created = await tx.vendor.create({
        data: {
            ownerId: userId,
            storeName: payload.storeName,
            slug,
            description: payload.description,
            businessEmail: payload.businessEmail,
            businessPhone: payload.businessPhone,
            taxId: payload.taxId,
            logo: logo?.url,
            logoPublicId: logo?.publicId,
            banner: banner?.url,
            bannerPublicId: banner?.publicId,
            payoutDetails: payload.payoutDetails as Prisma.InputJsonValue,
            // Platform defaults; an admin can tune them per store afterwards.
            commissionRate: envConfig.platform_commission_rate,
            shippingFee: envConfig.shipping_cost,
            freeShippingThreshold: envConfig.free_shipping_threshold,
            status: VendorStatus.PENDING,
            },
        });

        // The trail starts with the seller's own application: no previous
        // status, and the actor is the applicant rather than an admin.
        await logVendorStatusChange(tx, {
            vendorId: created.id,
            oldStatus: null,
            newStatus: VendorStatus.PENDING,
            actor: { id: userId },
            note: "Application submitted",
        });

        return created;
    });
};

/** Resubmit a rejected application on the existing row. */
const reapply = async (
    vendorId: string,
    ownerId: string,
    payload: TVendorApply,
) => {
    const [slug, logo, banner] = await Promise.all([
        generateUniqueVendorSlug(payload.storeName, vendorId),
        promoteImage(payload.logo),
        promoteImage(payload.banner),
    ]);

    return prisma.$transaction(async (tx) => {
        await logVendorStatusChange(tx, {
            vendorId,
            oldStatus: VendorStatus.REJECTED,
            newStatus: VendorStatus.PENDING,
            actor: { id: ownerId },
            note: "Application resubmitted",
        });

        return tx.vendor.update({
            where: { id: vendorId },
            data: {
                storeName: payload.storeName,
                slug,
                description: payload.description,
                businessEmail: payload.businessEmail,
                businessPhone: payload.businessPhone,
                taxId: payload.taxId,
                logo: logo?.url,
                logoPublicId: logo?.publicId,
                banner: banner?.url,
                bannerPublicId: banner?.publicId,
                payoutDetails: payload.payoutDetails as Prisma.InputJsonValue,
                status: VendorStatus.PENDING,
                rejectionReason: null,
                isDeleted: false,
            },
        });
    });
};

/**
 * The caller's own store in any status — this is what the vendor dashboard
 * reads to know whether the application is pending, rejected or live.
 */
const getMyStore = async (userId: string) => {
    const vendor = await findVendorByOwner(userId);

    if (!vendor) {
        throw new CustomError(404, "You do not have a vendor account yet");
    }

    // A seller gets their own moderation trail — being told *why* the store was
    // rejected or suspended, and when, is the whole point of keeping it. The
    // moderator's name and IP are stripped (`sanitizeVendorHistory`).
    const history = await prisma.vendorStatusHistory.findMany({
        where: { vendorId: vendor.id },
        select: vendorStatusHistorySelect,
        orderBy: { createdAt: "asc" },
    });

    return { ...vendor, statusHistory: sanitizeVendorHistory(history, false) };
};

const updateMyStore = async (userId: string, payload: TUpdateMyStore) => {
    const vendor = await getMyStore(userId);

    if (
        vendor.status === VendorStatus.SUSPENDED ||
        vendor.status === VendorStatus.REJECTED
    ) {
        throw new CustomError(
            403,
            "You cannot edit your store while it is suspended or rejected",
        );
    }

    const [logo, banner] = await Promise.all([
        promoteImage(payload.logo),
        promoteImage(payload.banner),
    ]);

    // Clean up the replaced assets only once the new ones are safely promoted.
    if (logo && vendor.logoPublicId && logo.publicId !== vendor.logoPublicId) {
        await deleteFromCloudinary(vendor.logoPublicId);
    }
    if (
        banner &&
        vendor.bannerPublicId &&
        banner.publicId !== vendor.bannerPublicId
    ) {
        await deleteFromCloudinary(vendor.bannerPublicId);
    }

    // Renaming the store re-derives the slug, which changes its public URL.
    const slug = payload.storeName
        ? await generateUniqueVendorSlug(payload.storeName, vendor.id)
        : undefined;

    return prisma.vendor.update({
        where: { id: vendor.id },
        data: {
            storeName: payload.storeName,
            slug,
            description: payload.description,
            businessEmail: payload.businessEmail,
            businessPhone: payload.businessPhone,
            taxId: payload.taxId,
            logo: logo?.url,
            logoPublicId: logo?.publicId,
            banner: banner?.url,
            bannerPublicId: banner?.publicId,
            payoutDetails: payload.payoutDetails as Prisma.InputJsonValue,
            shippingFee: payload.shippingFee,
            freeShippingThreshold: payload.freeShippingThreshold,
        },
    });
};

// ---------------------------------------------------------------- public reads

/** Approved, non-deleted stores for the storefront's vendor directory. */
const findAllPublic = async (query: Record<string, unknown>) => {
    const builder = new PrismaQueryBuilder<Prisma.VendorWhereInput>(query, { model: "Vendor" });

    const prismaArgs = builder
        .withDefaultFilter({
            status: VendorStatus.APPROVED,
            isDeleted: false,
        })
        .search(["storeName", "description"])
        .filter()
        .paginate()
        .sort("createdAt", "desc")
        .select(publicVendorSelect)
        .build();

    const [vendors, meta] = await Promise.all([
        prisma.vendor.findMany(prismaArgs),
        builder.getMeta(prisma.vendor),
    ]);

    return { meta, data: vendors };
};

/** A single storefront by slug, with its live product count. */
const findBySlug = async (slug: string) => {
    const vendor = await prisma.vendor.findFirst({
        where: { slug, status: VendorStatus.APPROVED, isDeleted: false },
        select: publicVendorSelect,
    });

    if (!vendor) {
        throw new CustomError(404, "Store not found");
    }

    const totalProducts = await prisma.product.count({
        where: publicProductFilter({ vendorId: vendor.id }),
    });

    return { ...vendor, totalProducts };
};

// ----------------------------------------------------------------- admin reads

/**
 * Every store in any status — the admin moderation queue.
 * `?status=PENDING` narrows it via the standard filter handling.
 */
const findAllForAdmin = async (query: Record<string, unknown>) => {
    const builder = new PrismaQueryBuilder<Prisma.VendorWhereInput>(query, { model: "Vendor" });

    const prismaArgs = builder
        .withDefaultFilter({ isDeleted: false })
        .search(["storeName", "businessEmail", "description"])
        .filter()
        .paginate()
        .sort("createdAt", "desc")
        .include({
            owner: {
                select: {
                    id: true,
                    name: true,
                    avatar: true,
                    auth: { select: { email: true, role: true } },
                },
            },
            _count: { select: { products: true, vendorOrders: true } },
        })
        .build();

    const [vendors, meta] = await Promise.all([
        prisma.vendor.findMany(prismaArgs),
        builder.getMeta(prisma.vendor),
    ]);

    return { meta, data: vendors };
};

const findByIdForAdmin = async (vendorId: string) => {
    const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        include: {
            owner: {
                select: {
                    id: true,
                    name: true,
                    avatar: true,
                    auth: { select: { email: true, role: true } },
                },
            },
            _count: {
                select: { products: true, vendorOrders: true, payouts: true },
            },
            // The full moderation trail, newest first: who acted, from where,
            // and every earlier decision the three columns on Vendor forget.
            statusHistory: {
                select: vendorStatusHistorySelect,
                orderBy: { createdAt: "desc" },
            },
        },
    });

    if (!vendor) {
        throw new CustomError(404, "Vendor not found");
    }

    return {
        ...vendor,
        statusHistory: sanitizeVendorHistory(vendor.statusHistory, true),
    };
};

// ------------------------------------------------------------ admin moderation

/**
 * Approve a store and promote its owner to VENDOR.
 *
 * An ADMIN owner keeps their role — an admin running a store must not be
 * demoted out of the admin panel.
 */
const approveVendor = async (vendorId: string, actor: TModerationActor) => {
    const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        include: { owner: { include: { auth: true } } },
    });

    if (!vendor) {
        throw new CustomError(404, "Vendor not found");
    }

    if (vendor.status === VendorStatus.APPROVED) {
        throw new CustomError(400, "This store is already approved");
    }

    const approved = await prisma.$transaction(async (tx) => {
        if (vendor.owner.auth && vendor.owner.auth.role !== Role.ADMIN) {
            await tx.auth.update({
                where: { userId: vendor.ownerId },
                data: { role: Role.VENDOR },
            });
        }

        await logVendorStatusChange(tx, {
            vendorId,
            oldStatus: vendor.status,
            newStatus: VendorStatus.APPROVED,
            actor,
            note: "Store approved",
        });

        return tx.vendor.update({
            where: { id: vendorId },
            data: {
                status: VendorStatus.APPROVED,
                approvedAt: new Date(),
                suspendedAt: null,
                rejectionReason: null,
                isDeleted: false,
            },
        });
    });

    // After the commit. The seller can now reach their dashboard immediately —
    // `authGuard` reads the role from the database (BE-07), so the mail is not
    // promising something their old token cannot do.
    await notifyVendorApplicationDecision(vendorId, true);

    return approved;
};

/** Reject an application and hand the role back to CUSTOMER. */
const rejectVendor = async (
    vendorId: string,
    payload: TRejectVendor,
    actor: TModerationActor,
) => {
    const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        include: { owner: { include: { auth: true } } },
    });

    if (!vendor) {
        throw new CustomError(404, "Vendor not found");
    }

    const rejected = await prisma.$transaction(async (tx) => {
        if (vendor.owner.auth && vendor.owner.auth.role === Role.VENDOR) {
            await tx.auth.update({
                where: { userId: vendor.ownerId },
                data: { role: Role.CUSTOMER },
            });
        }

        await logVendorStatusChange(tx, {
            vendorId,
            oldStatus: vendor.status,
            newStatus: VendorStatus.REJECTED,
            actor,
            note: payload.reason,
        });

        // Hide the catalogue: rejected stores must not keep live listings.
        await tx.product.updateMany({
            where: { vendorId },
            data: { isPublished: false },
        });

        return tx.vendor.update({
            where: { id: vendorId },
            data: {
                status: VendorStatus.REJECTED,
                rejectionReason: payload.reason,
                approvedAt: null,
            },
        });
    });

    // After the commit, so the mail can quote the stored rejection reason.
    await notifyVendorApplicationDecision(vendorId, false);

    return rejected;
};

/**
 * Suspend a live store.
 *
 * The role stays VENDOR so the owner can still see their dashboard and
 * outstanding orders, but `requireApprovedVendor` blocks every write and
 * `publicProductFilter` hides the catalogue from shoppers immediately.
 * In-flight orders are deliberately left alone — buyers are still owed those.
 */
const suspendVendor = async (
    vendorId: string,
    payload: TSuspendVendor,
    actor: TModerationActor,
) => {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });

    if (!vendor) {
        throw new CustomError(404, "Vendor not found");
    }

    if (vendor.status === VendorStatus.SUSPENDED) {
        throw new CustomError(400, "This store is already suspended");
    }

    // One transaction: the trail must not be able to disagree with the row.
    return prisma.$transaction(async (tx) => {
        await logVendorStatusChange(tx, {
            vendorId,
            oldStatus: vendor.status,
            newStatus: VendorStatus.SUSPENDED,
            actor,
            note: payload.reason,
        });

        return tx.vendor.update({
            where: { id: vendorId },
            data: {
                status: VendorStatus.SUSPENDED,
                suspendedAt: new Date(),
                rejectionReason: payload.reason,
            },
        });
    });
};

/** Lift a suspension. Listings stay hidden until the vendor republishes. */
const reinstateVendor = async (vendorId: string, actor: TModerationActor) => {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });

    if (!vendor) {
        throw new CustomError(404, "Vendor not found");
    }

    if (vendor.status !== VendorStatus.SUSPENDED) {
        throw new CustomError(400, "This store is not suspended");
    }

    return prisma.$transaction(async (tx) => {
        await logVendorStatusChange(tx, {
            vendorId,
            oldStatus: vendor.status,
            newStatus: VendorStatus.APPROVED,
            actor,
            note: "Suspension lifted",
        });

        return tx.vendor.update({
            where: { id: vendorId },
            data: {
                status: VendorStatus.APPROVED,
                suspendedAt: null,
                rejectionReason: null,
            },
        });
    });
};

/** Admin-only commercial terms. Only affects orders placed from now on. */
const updateVendorSettings = async (
    vendorId: string,
    payload: TUpdateVendorSettings,
    actor: TModerationActor,
) => {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });

    if (!vendor) {
        throw new CustomError(404, "Vendor not found");
    }

    /**
     * Commercial terms are not a status change, but they are an admin acting on
     * someone else's store, and "who cut our margin, and when?" is exactly the
     * question this trail exists to answer. Logged with `oldStatus ===
     * newStatus` and the change spelled out.
     *
     * `VendorOrder.commissionRate` is a snapshot, so this only affects orders
     * placed from now on — worth saying in the note.
     */
    const changes: string[] = [];
    const describe = (
        label: string,
        before: Prisma.Decimal,
        after?: number,
    ) => {
        if (after === undefined || toNumber(before) === after) return;
        changes.push(`${label} ${toNumber(before)} → ${after}`);
    };

    describe("commission", vendor.commissionRate, payload.commissionRate);
    describe("shipping fee", vendor.shippingFee, payload.shippingFee);
    describe(
        "free shipping threshold",
        vendor.freeShippingThreshold,
        payload.freeShippingThreshold,
    );

    return prisma.$transaction(async (tx) => {
        if (changes.length > 0) {
            await logVendorStatusChange(tx, {
                vendorId,
                oldStatus: vendor.status,
                newStatus: vendor.status,
                actor,
                note: `Terms updated — ${changes.join(", ")}`,
            });
        }

        return tx.vendor.update({
            where: { id: vendorId },
            data: {
                commissionRate: payload.commissionRate,
                shippingFee: payload.shippingFee,
                freeShippingThreshold: payload.freeShippingThreshold,
            },
        });
    });
};

/** Soft-delete a store and unpublish everything it listed. */
const deleteVendor = async (vendorId: string, actor: TModerationActor) => {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });

    if (!vendor) {
        throw new CustomError(404, "Vendor not found");
    }

    const openOrders = await prisma.vendorOrder.count({
        where: {
            vendorId,
            orderStatus: {
                notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELED],
            },
        },
    });

    if (openOrders > 0) {
        throw new CustomError(
            400,
            `This store still has ${openOrders} order(s) in flight. Suspend it instead, or settle those first.`,
        );
    }

    return prisma.$transaction(async (tx) => {
        await tx.product.updateMany({
            where: { vendorId },
            data: { isPublished: false, isDeleted: true },
        });

        await logVendorStatusChange(tx, {
            vendorId,
            oldStatus: vendor.status,
            newStatus: VendorStatus.SUSPENDED,
            actor,
            note: "Store deleted by an admin",
        });

        return tx.vendor.update({
            where: { id: vendorId },
            data: { isDeleted: true, status: VendorStatus.SUSPENDED },
        });
    });
};

// -------------------------------------------------------------------- analytics

const DAY_MS = 24 * 60 * 60 * 1000;
/** The trend's window when the caller names none. */
const DEFAULT_TREND_DAYS = 30;
/** One point per day, so a window is capped to keep the series chartable. */
const MAX_TREND_DAYS = 366;

const startOfUtcDay = (date: Date) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

/**
 * One point per UTC day across the window, zero-filled so a quiet day is a
 * visible dip rather than a gap the chart silently joins across.
 *
 * `orders` counts every parcel placed, like `overview.totalOrders`; the money
 * uses the same rule as `overview` (paid, not cancelled), so the series sums to
 * the headline figures for the same window.
 */
const buildSalesTrend = async (vendorId: string, start: Date, end: Date) => {
    const parcels = await prisma.vendorOrder.findMany({
        where: { vendorId, createdAt: { gte: start, lte: end } },
        select: {
            createdAt: true,
            orderStatus: true,
            totalAmount: true,
            vendorEarning: true,
            order: { select: { paymentStatus: true } },
        },
    });

    const buckets = new Map<
        string,
        { date: string; orders: number; grossSales: number; netEarnings: number }
    >();
    for (
        let day = startOfUtcDay(start).getTime();
        day <= end.getTime();
        day += DAY_MS
    ) {
        const date = new Date(day).toISOString().slice(0, 10);
        buckets.set(date, { date, orders: 0, grossSales: 0, netEarnings: 0 });
    }

    for (const parcel of parcels) {
        const bucket = buckets.get(parcel.createdAt.toISOString().slice(0, 10));
        if (!bucket) continue;

        bucket.orders += 1;
        if (
            parcel.orderStatus !== OrderStatus.CANCELED &&
            parcel.order.paymentStatus === PaymentStatus.PAID
        ) {
            bucket.grossSales = round2(bucket.grossSales + toNumber(parcel.totalAmount));
            bucket.netEarnings = round2(
                bucket.netEarnings + toNumber(parcel.vendorEarning),
            );
        }
    }

    return [...buckets.values()];
};

/**
 * The vendor dashboard.
 *
 * Every figure is scoped to the caller's own store: revenue comes from that
 * store's VendorOrders, never from the parent Order (which may include other
 * vendors' money).
 */
const getMyDashboard = async (
    userId: string,
    range?: { startDate?: Date; endDate?: Date },
) => {
    const vendor = await requireApprovedVendor(userId);

    const { startDate, endDate } = range ?? {};
    // `new Date("garbage")` is an Invalid Date, which Prisma rejects with a 500.
    if (
        (startDate && Number.isNaN(startDate.getTime())) ||
        (endDate && Number.isNaN(endDate.getTime()))
    ) {
        throw new CustomError(400, "startDate and endDate must be valid dates");
    }
    if (startDate && endDate && startDate > endDate) {
        throw new CustomError(400, "startDate must be before endDate");
    }

    // The headline figures are all-time without a range; the trend always has
    // a window, since a series from the store's first day is not chartable.
    const trendEnd = endDate ?? new Date();
    const trendStart =
        startDate ?? new Date(startOfUtcDay(trendEnd).getTime() - (DEFAULT_TREND_DAYS - 1) * DAY_MS);
    if (trendEnd.getTime() - trendStart.getTime() > MAX_TREND_DAYS * DAY_MS) {
        throw new CustomError(400, `The date range may span at most ${MAX_TREND_DAYS} days`);
    }

    const dateFilter =
        range?.startDate && range?.endDate
            ? { createdAt: { gte: range.startDate, lte: range.endDate } }
            : {};

    const scope: Prisma.VendorOrderWhereInput = {
        vendorId: vendor.id,
        ...dateFilter,
    };

    const [
        totalOrders,
        earnings,
        ordersByStatus,
        productCounts,
        pendingPayout,
        topProducts,
        recentOrders,
        salesTrend,
    ] = await Promise.all([
        prisma.vendorOrder.count({ where: scope }),

        // Money the store has actually earned: paid orders that were not
        // canceled. `vendorEarning` already excludes commission and tax.
        prisma.vendorOrder.aggregate({
            where: {
                ...scope,
                orderStatus: { not: OrderStatus.CANCELED },
                order: { paymentStatus: PaymentStatus.PAID },
            },
            _sum: {
                vendorEarning: true,
                commissionAmount: true,
                totalAmount: true,
                subtotal: true,
            },
        }),

        prisma.vendorOrder.groupBy({
            by: ["orderStatus"],
            where: scope,
            _count: { id: true },
        }),

        prisma.product.groupBy({
            by: ["status"],
            where: { vendorId: vendor.id, isDeleted: false },
            _count: { id: true },
        }),

        // Delivered and paid, but not yet attached to a payout.
        prisma.vendorOrder.aggregate({
            where: {
                vendorId: vendor.id,
                orderStatus: OrderStatus.DELIVERED,
                payoutId: null,
                order: { paymentStatus: PaymentStatus.PAID },
            },
            _sum: { vendorEarning: true },
            _count: { id: true },
        }),

        prisma.orderItem.groupBy({
            by: ["productId", "productName"],
            where: {
                vendorId: vendor.id,
                vendorOrder: {
                    orderStatus: { not: OrderStatus.CANCELED },
                    ...dateFilter,
                },
            },
            _sum: { quantity: true, subtotal: true },
            orderBy: { _sum: { quantity: "desc" } },
            take: 10,
        }),

        prisma.vendorOrder.findMany({
            where: scope,
            include: {
                items: true,
                order: {
                    select: {
                        orderNumber: true,
                        paymentStatus: true,
                        createdAt: true,
                        user: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
        }),

        buildSalesTrend(vendor.id, trendStart, trendEnd),
    ]);

    const netEarnings = toNumber(earnings._sum.vendorEarning);
    const grossSales = toNumber(earnings._sum.totalAmount);

    return {
        store: {
            id: vendor.id,
            storeName: vendor.storeName,
            slug: vendor.slug,
            status: vendor.status,
            averageRating: vendor.averageRating,
            totalReviews: vendor.totalReviews,
            commissionRate: toNumber(vendor.commissionRate),
        },
        overview: {
            totalOrders,
            grossSales,
            netEarnings,
            commissionPaid: toNumber(earnings._sum.commissionAmount),
            averageOrderValue:
                totalOrders > 0 ? Number((grossSales / totalOrders).toFixed(2)) : 0,
            pendingPayoutAmount: toNumber(pendingPayout._sum.vendorEarning),
            pendingPayoutOrders: pendingPayout._count.id,
        },
        ordersByStatus: ordersByStatus.map((row) => ({
            status: row.orderStatus,
            count: row._count.id,
        })),
        productsByStatus: productCounts.map((row) => ({
            status: row.status,
            count: row._count.id,
        })),
        topProducts: topProducts.map((row) => ({
            productId: row.productId,
            productName: row.productName,
            quantitySold: row._sum.quantity ?? 0,
            revenue: toNumber(row._sum.subtotal),
        })),
        recentOrders,
        salesTrend,
    };
};

export const vendorServices = {
    applyForVendor,
    getMyStore,
    updateMyStore,
    getMyDashboard,
    //
    findAllPublic,
    findBySlug,
    //
    findAllForAdmin,
    findByIdForAdmin,
    approveVendor,
    rejectVendor,
    suspendVendor,
    reinstateVendor,
    updateVendorSettings,
    deleteVendor,
};
