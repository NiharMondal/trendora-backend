import {
    OrderStatus,
    PaymentStatus,
    Prisma,
    Role,
    VendorStatus,
} from "../../../generated/prisma";
import { prisma } from "../../config/db";
import { envConfig } from "../../config/env-config";
import { toNumber } from "../../helpers/money";
import { generateUniqueVendorSlug } from "../../helpers/slug";
import {
    findVendorByOwner,
    publicProductFilter,
    publicVendorSelect,
    requireApprovedVendor,
} from "../../helpers/vendor";
import PrismaQueryBuilder from "../../lib/PrismaQueryBuilder";
import { deleteFromCloudinary, moveFromTemp } from "../../utils/cloudinary";
import CustomError from "../../utils/customError";
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
            return reapply(existing.id, payload);
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

    return prisma.vendor.create({
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
};

/** Resubmit a rejected application on the existing row. */
const reapply = async (vendorId: string, payload: TVendorApply) => {
    const [slug, logo, banner] = await Promise.all([
        generateUniqueVendorSlug(payload.storeName, vendorId),
        promoteImage(payload.logo),
        promoteImage(payload.banner),
    ]);

    return prisma.vendor.update({
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

    return vendor;
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
    const builder = new PrismaQueryBuilder<Prisma.VendorWhereInput>(query);

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
    const builder = new PrismaQueryBuilder<Prisma.VendorWhereInput>(query);

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
        },
    });

    if (!vendor) {
        throw new CustomError(404, "Vendor not found");
    }

    return vendor;
};

// ------------------------------------------------------------ admin moderation

/**
 * Approve a store and promote its owner to VENDOR.
 *
 * An ADMIN owner keeps their role — an admin running a store must not be
 * demoted out of the admin panel.
 */
const approveVendor = async (vendorId: string) => {
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

    return prisma.$transaction(async (tx) => {
        if (vendor.owner.auth && vendor.owner.auth.role !== Role.ADMIN) {
            await tx.auth.update({
                where: { userId: vendor.ownerId },
                data: { role: Role.VENDOR },
            });
        }

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
};

/** Reject an application and hand the role back to CUSTOMER. */
const rejectVendor = async (vendorId: string, payload: TRejectVendor) => {
    const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        include: { owner: { include: { auth: true } } },
    });

    if (!vendor) {
        throw new CustomError(404, "Vendor not found");
    }

    return prisma.$transaction(async (tx) => {
        if (vendor.owner.auth && vendor.owner.auth.role === Role.VENDOR) {
            await tx.auth.update({
                where: { userId: vendor.ownerId },
                data: { role: Role.CUSTOMER },
            });
        }

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
};

/**
 * Suspend a live store.
 *
 * The role stays VENDOR so the owner can still see their dashboard and
 * outstanding orders, but `requireApprovedVendor` blocks every write and
 * `publicProductFilter` hides the catalogue from shoppers immediately.
 * In-flight orders are deliberately left alone — buyers are still owed those.
 */
const suspendVendor = async (vendorId: string, payload: TSuspendVendor) => {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });

    if (!vendor) {
        throw new CustomError(404, "Vendor not found");
    }

    if (vendor.status === VendorStatus.SUSPENDED) {
        throw new CustomError(400, "This store is already suspended");
    }

    return prisma.vendor.update({
        where: { id: vendorId },
        data: {
            status: VendorStatus.SUSPENDED,
            suspendedAt: new Date(),
            rejectionReason: payload.reason,
        },
    });
};

/** Lift a suspension. Listings stay hidden until the vendor republishes. */
const reinstateVendor = async (vendorId: string) => {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });

    if (!vendor) {
        throw new CustomError(404, "Vendor not found");
    }

    if (vendor.status !== VendorStatus.SUSPENDED) {
        throw new CustomError(400, "This store is not suspended");
    }

    return prisma.vendor.update({
        where: { id: vendorId },
        data: {
            status: VendorStatus.APPROVED,
            suspendedAt: null,
            rejectionReason: null,
        },
    });
};

/** Admin-only commercial terms. Only affects orders placed from now on. */
const updateVendorSettings = async (
    vendorId: string,
    payload: TUpdateVendorSettings,
) => {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });

    if (!vendor) {
        throw new CustomError(404, "Vendor not found");
    }

    return prisma.vendor.update({
        where: { id: vendorId },
        data: {
            commissionRate: payload.commissionRate,
            shippingFee: payload.shippingFee,
            freeShippingThreshold: payload.freeShippingThreshold,
        },
    });
};

/** Soft-delete a store and unpublish everything it listed. */
const deleteVendor = async (vendorId: string) => {
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

        return tx.vendor.update({
            where: { id: vendorId },
            data: { isDeleted: true, status: VendorStatus.SUSPENDED },
        });
    });
};

// -------------------------------------------------------------------- analytics

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
