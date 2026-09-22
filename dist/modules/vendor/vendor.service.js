"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorServices = void 0;
const prisma_client_1 = require("../../lib/prisma-client.js");
const db_1 = require("../../config/db.js");
const env_config_1 = require("../../config/env-config.js");
const money_1 = require("../../helpers/money.js");
const slug_1 = require("../../helpers/slug.js");
const vendor_1 = require("../../helpers/vendor.js");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder.js"));
const cloudinary_1 = require("../../utils/cloudinary.js");
const customError_1 = __importDefault(require("../../utils/customError.js"));
const notifications_1 = require("../../helpers/notifications.js");
/**
 * Promotes a Cloudinary temp upload into its final folder.
 *
 * The frontend uploads straight to `trendora/<folder>/temp/` and sends us
 * `{ url, publicId }`; only assets still in `temp/` are moved, which is the
 * same guard the product service uses to avoid touching a live image.
 */
const promoteImage = async (image) => {
    if (!image)
        return undefined;
    if (image.publicId.includes("/temp/")) {
        return (0, cloudinary_1.moveFromTemp)(image.publicId);
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
const applyForVendor = async (userId, payload) => {
    const user = await db_1.prisma.user.findUnique({
        where: { id: userId },
        include: { auth: true },
    });
    if (!user || user.isDeleted) {
        throw new customError_1.default(404, "User not found");
    }
    const existing = await db_1.prisma.vendor.findFirst({
        where: { ownerId: userId },
    });
    if (existing) {
        // A rejected applicant may re-apply; the same row is reused so the
        // one-store-per-user invariant (Vendor.ownerId is unique) holds.
        if (existing.status === prisma_client_1.VendorStatus.REJECTED) {
            return reapply(existing.id, userId, payload);
        }
        throw new customError_1.default(409, existing.status === prisma_client_1.VendorStatus.PENDING
            ? "You already have a vendor application under review"
            : "You already have a vendor account");
    }
    const [slug, logo, banner] = await Promise.all([
        (0, slug_1.generateUniqueVendorSlug)(payload.storeName),
        promoteImage(payload.logo),
        promoteImage(payload.banner),
    ]);
    return db_1.prisma.$transaction(async (tx) => {
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
                payoutDetails: payload.payoutDetails,
                // Platform defaults; an admin can tune them per store afterwards.
                commissionRate: env_config_1.envConfig.platform_commission_rate,
                shippingFee: env_config_1.envConfig.shipping_cost,
                freeShippingThreshold: env_config_1.envConfig.free_shipping_threshold,
                status: prisma_client_1.VendorStatus.PENDING,
            },
        });
        // The trail starts with the seller's own application: no previous
        // status, and the actor is the applicant rather than an admin.
        await (0, vendor_1.logVendorStatusChange)(tx, {
            vendorId: created.id,
            oldStatus: null,
            newStatus: prisma_client_1.VendorStatus.PENDING,
            actor: { id: userId },
            note: "Application submitted",
        });
        return created;
    });
};
/** Resubmit a rejected application on the existing row. */
const reapply = async (vendorId, ownerId, payload) => {
    const [slug, logo, banner] = await Promise.all([
        (0, slug_1.generateUniqueVendorSlug)(payload.storeName, vendorId),
        promoteImage(payload.logo),
        promoteImage(payload.banner),
    ]);
    return db_1.prisma.$transaction(async (tx) => {
        await (0, vendor_1.logVendorStatusChange)(tx, {
            vendorId,
            oldStatus: prisma_client_1.VendorStatus.REJECTED,
            newStatus: prisma_client_1.VendorStatus.PENDING,
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
                payoutDetails: payload.payoutDetails,
                status: prisma_client_1.VendorStatus.PENDING,
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
const getMyStore = async (userId) => {
    const vendor = await (0, vendor_1.findVendorByOwner)(userId);
    if (!vendor) {
        throw new customError_1.default(404, "You do not have a vendor account yet");
    }
    // A seller gets their own moderation trail — being told *why* the store was
    // rejected or suspended, and when, is the whole point of keeping it. The
    // moderator's name and IP are stripped (`sanitizeVendorHistory`).
    const history = await db_1.prisma.vendorStatusHistory.findMany({
        where: { vendorId: vendor.id },
        select: vendor_1.vendorStatusHistorySelect,
        orderBy: { createdAt: "asc" },
    });
    return { ...vendor, statusHistory: (0, vendor_1.sanitizeVendorHistory)(history, false) };
};
const updateMyStore = async (userId, payload) => {
    const vendor = await getMyStore(userId);
    if (vendor.status === prisma_client_1.VendorStatus.SUSPENDED ||
        vendor.status === prisma_client_1.VendorStatus.REJECTED) {
        throw new customError_1.default(403, "You cannot edit your store while it is suspended or rejected");
    }
    const [logo, banner] = await Promise.all([
        promoteImage(payload.logo),
        promoteImage(payload.banner),
    ]);
    // Clean up the replaced assets only once the new ones are safely promoted.
    if (logo && vendor.logoPublicId && logo.publicId !== vendor.logoPublicId) {
        await (0, cloudinary_1.deleteFromCloudinary)(vendor.logoPublicId);
    }
    if (banner &&
        vendor.bannerPublicId &&
        banner.publicId !== vendor.bannerPublicId) {
        await (0, cloudinary_1.deleteFromCloudinary)(vendor.bannerPublicId);
    }
    // Renaming the store re-derives the slug, which changes its public URL.
    const slug = payload.storeName
        ? await (0, slug_1.generateUniqueVendorSlug)(payload.storeName, vendor.id)
        : undefined;
    return db_1.prisma.vendor.update({
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
            payoutDetails: payload.payoutDetails,
            shippingFee: payload.shippingFee,
            freeShippingThreshold: payload.freeShippingThreshold,
        },
    });
};
// ---------------------------------------------------------------- public reads
/** Approved, non-deleted stores for the storefront's vendor directory. */
const findAllPublic = async (query) => {
    const builder = new PrismaQueryBuilder_1.default(query, { model: "Vendor" });
    const prismaArgs = builder
        .withDefaultFilter({
        status: prisma_client_1.VendorStatus.APPROVED,
        isDeleted: false,
    })
        .search(["storeName", "description"])
        .filter()
        .paginate()
        .sort("createdAt", "desc")
        .select(vendor_1.publicVendorSelect)
        .build();
    const [vendors, meta] = await Promise.all([
        db_1.prisma.vendor.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.vendor),
    ]);
    return { meta, data: vendors };
};
/** A single storefront by slug, with its live product count. */
const findBySlug = async (slug) => {
    const vendor = await db_1.prisma.vendor.findFirst({
        where: { slug, status: prisma_client_1.VendorStatus.APPROVED, isDeleted: false },
        select: vendor_1.publicVendorSelect,
    });
    if (!vendor) {
        throw new customError_1.default(404, "Store not found");
    }
    const totalProducts = await db_1.prisma.product.count({
        where: (0, vendor_1.publicProductFilter)({ vendorId: vendor.id }),
    });
    return { ...vendor, totalProducts };
};
// ----------------------------------------------------------------- admin reads
/**
 * Every store in any status — the admin moderation queue.
 * `?status=PENDING` narrows it via the standard filter handling.
 */
const findAllForAdmin = async (query) => {
    const builder = new PrismaQueryBuilder_1.default(query, { model: "Vendor" });
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
        db_1.prisma.vendor.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.vendor),
    ]);
    return { meta, data: vendors };
};
const findByIdForAdmin = async (vendorId) => {
    const vendor = await db_1.prisma.vendor.findUnique({
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
                select: vendor_1.vendorStatusHistorySelect,
                orderBy: { createdAt: "desc" },
            },
        },
    });
    if (!vendor) {
        throw new customError_1.default(404, "Vendor not found");
    }
    return {
        ...vendor,
        statusHistory: (0, vendor_1.sanitizeVendorHistory)(vendor.statusHistory, true),
    };
};
// ------------------------------------------------------------ admin moderation
/**
 * Approve a store and promote its owner to VENDOR.
 *
 * An ADMIN owner keeps their role — an admin running a store must not be
 * demoted out of the admin panel.
 */
const approveVendor = async (vendorId, actor) => {
    const vendor = await db_1.prisma.vendor.findUnique({
        where: { id: vendorId },
        include: { owner: { include: { auth: true } } },
    });
    if (!vendor) {
        throw new customError_1.default(404, "Vendor not found");
    }
    if (vendor.status === prisma_client_1.VendorStatus.APPROVED) {
        throw new customError_1.default(400, "This store is already approved");
    }
    const approved = await db_1.prisma.$transaction(async (tx) => {
        if (vendor.owner.auth && vendor.owner.auth.role !== prisma_client_1.Role.ADMIN) {
            await tx.auth.update({
                where: { userId: vendor.ownerId },
                data: { role: prisma_client_1.Role.VENDOR },
            });
        }
        await (0, vendor_1.logVendorStatusChange)(tx, {
            vendorId,
            oldStatus: vendor.status,
            newStatus: prisma_client_1.VendorStatus.APPROVED,
            actor,
            note: "Store approved",
        });
        return tx.vendor.update({
            where: { id: vendorId },
            data: {
                status: prisma_client_1.VendorStatus.APPROVED,
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
    await (0, notifications_1.notifyVendorApplicationDecision)(vendorId, true);
    return approved;
};
/** Reject an application and hand the role back to CUSTOMER. */
const rejectVendor = async (vendorId, payload, actor) => {
    const vendor = await db_1.prisma.vendor.findUnique({
        where: { id: vendorId },
        include: { owner: { include: { auth: true } } },
    });
    if (!vendor) {
        throw new customError_1.default(404, "Vendor not found");
    }
    const rejected = await db_1.prisma.$transaction(async (tx) => {
        if (vendor.owner.auth && vendor.owner.auth.role === prisma_client_1.Role.VENDOR) {
            await tx.auth.update({
                where: { userId: vendor.ownerId },
                data: { role: prisma_client_1.Role.CUSTOMER },
            });
        }
        await (0, vendor_1.logVendorStatusChange)(tx, {
            vendorId,
            oldStatus: vendor.status,
            newStatus: prisma_client_1.VendorStatus.REJECTED,
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
                status: prisma_client_1.VendorStatus.REJECTED,
                rejectionReason: payload.reason,
                approvedAt: null,
            },
        });
    });
    // After the commit, so the mail can quote the stored rejection reason.
    await (0, notifications_1.notifyVendorApplicationDecision)(vendorId, false);
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
const suspendVendor = async (vendorId, payload, actor) => {
    const vendor = await db_1.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
        throw new customError_1.default(404, "Vendor not found");
    }
    if (vendor.status === prisma_client_1.VendorStatus.SUSPENDED) {
        throw new customError_1.default(400, "This store is already suspended");
    }
    // One transaction: the trail must not be able to disagree with the row.
    return db_1.prisma.$transaction(async (tx) => {
        await (0, vendor_1.logVendorStatusChange)(tx, {
            vendorId,
            oldStatus: vendor.status,
            newStatus: prisma_client_1.VendorStatus.SUSPENDED,
            actor,
            note: payload.reason,
        });
        return tx.vendor.update({
            where: { id: vendorId },
            data: {
                status: prisma_client_1.VendorStatus.SUSPENDED,
                suspendedAt: new Date(),
                rejectionReason: payload.reason,
            },
        });
    });
};
/** Lift a suspension. Listings stay hidden until the vendor republishes. */
const reinstateVendor = async (vendorId, actor) => {
    const vendor = await db_1.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
        throw new customError_1.default(404, "Vendor not found");
    }
    if (vendor.status !== prisma_client_1.VendorStatus.SUSPENDED) {
        throw new customError_1.default(400, "This store is not suspended");
    }
    return db_1.prisma.$transaction(async (tx) => {
        await (0, vendor_1.logVendorStatusChange)(tx, {
            vendorId,
            oldStatus: vendor.status,
            newStatus: prisma_client_1.VendorStatus.APPROVED,
            actor,
            note: "Suspension lifted",
        });
        return tx.vendor.update({
            where: { id: vendorId },
            data: {
                status: prisma_client_1.VendorStatus.APPROVED,
                suspendedAt: null,
                rejectionReason: null,
            },
        });
    });
};
/** Admin-only commercial terms. Only affects orders placed from now on. */
const updateVendorSettings = async (vendorId, payload, actor) => {
    const vendor = await db_1.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
        throw new customError_1.default(404, "Vendor not found");
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
    const changes = [];
    const describe = (label, before, after) => {
        if (after === undefined || (0, money_1.toNumber)(before) === after)
            return;
        changes.push(`${label} ${(0, money_1.toNumber)(before)} → ${after}`);
    };
    describe("commission", vendor.commissionRate, payload.commissionRate);
    describe("shipping fee", vendor.shippingFee, payload.shippingFee);
    describe("free shipping threshold", vendor.freeShippingThreshold, payload.freeShippingThreshold);
    return db_1.prisma.$transaction(async (tx) => {
        if (changes.length > 0) {
            await (0, vendor_1.logVendorStatusChange)(tx, {
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
const deleteVendor = async (vendorId, actor) => {
    const vendor = await db_1.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
        throw new customError_1.default(404, "Vendor not found");
    }
    const openOrders = await db_1.prisma.vendorOrder.count({
        where: {
            vendorId,
            orderStatus: {
                notIn: [prisma_client_1.OrderStatus.DELIVERED, prisma_client_1.OrderStatus.CANCELED],
            },
        },
    });
    if (openOrders > 0) {
        throw new customError_1.default(400, `This store still has ${openOrders} order(s) in flight. Suspend it instead, or settle those first.`);
    }
    return db_1.prisma.$transaction(async (tx) => {
        await tx.product.updateMany({
            where: { vendorId },
            data: { isPublished: false, isDeleted: true },
        });
        await (0, vendor_1.logVendorStatusChange)(tx, {
            vendorId,
            oldStatus: vendor.status,
            newStatus: prisma_client_1.VendorStatus.SUSPENDED,
            actor,
            note: "Store deleted by an admin",
        });
        return tx.vendor.update({
            where: { id: vendorId },
            data: { isDeleted: true, status: prisma_client_1.VendorStatus.SUSPENDED },
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
const getMyDashboard = async (userId, range) => {
    const vendor = await (0, vendor_1.requireApprovedVendor)(userId);
    const dateFilter = range?.startDate && range?.endDate
        ? { createdAt: { gte: range.startDate, lte: range.endDate } }
        : {};
    const scope = {
        vendorId: vendor.id,
        ...dateFilter,
    };
    const [totalOrders, earnings, ordersByStatus, productCounts, pendingPayout, topProducts, recentOrders,] = await Promise.all([
        db_1.prisma.vendorOrder.count({ where: scope }),
        // Money the store has actually earned: paid orders that were not
        // canceled. `vendorEarning` already excludes commission and tax.
        db_1.prisma.vendorOrder.aggregate({
            where: {
                ...scope,
                orderStatus: { not: prisma_client_1.OrderStatus.CANCELED },
                order: { paymentStatus: prisma_client_1.PaymentStatus.PAID },
            },
            _sum: {
                vendorEarning: true,
                commissionAmount: true,
                totalAmount: true,
                subtotal: true,
            },
        }),
        db_1.prisma.vendorOrder.groupBy({
            by: ["orderStatus"],
            where: scope,
            _count: { id: true },
        }),
        db_1.prisma.product.groupBy({
            by: ["status"],
            where: { vendorId: vendor.id, isDeleted: false },
            _count: { id: true },
        }),
        // Delivered and paid, but not yet attached to a payout.
        db_1.prisma.vendorOrder.aggregate({
            where: {
                vendorId: vendor.id,
                orderStatus: prisma_client_1.OrderStatus.DELIVERED,
                payoutId: null,
                order: { paymentStatus: prisma_client_1.PaymentStatus.PAID },
            },
            _sum: { vendorEarning: true },
            _count: { id: true },
        }),
        db_1.prisma.orderItem.groupBy({
            by: ["productId", "productName"],
            where: {
                vendorId: vendor.id,
                vendorOrder: {
                    orderStatus: { not: prisma_client_1.OrderStatus.CANCELED },
                    ...dateFilter,
                },
            },
            _sum: { quantity: true, subtotal: true },
            orderBy: { _sum: { quantity: "desc" } },
            take: 10,
        }),
        db_1.prisma.vendorOrder.findMany({
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
    const netEarnings = (0, money_1.toNumber)(earnings._sum.vendorEarning);
    const grossSales = (0, money_1.toNumber)(earnings._sum.totalAmount);
    return {
        store: {
            id: vendor.id,
            storeName: vendor.storeName,
            slug: vendor.slug,
            status: vendor.status,
            averageRating: vendor.averageRating,
            totalReviews: vendor.totalReviews,
            commissionRate: (0, money_1.toNumber)(vendor.commissionRate),
        },
        overview: {
            totalOrders,
            grossSales,
            netEarnings,
            commissionPaid: (0, money_1.toNumber)(earnings._sum.commissionAmount),
            averageOrderValue: totalOrders > 0 ? Number((grossSales / totalOrders).toFixed(2)) : 0,
            pendingPayoutAmount: (0, money_1.toNumber)(pendingPayout._sum.vendorEarning),
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
            revenue: (0, money_1.toNumber)(row._sum.subtotal),
        })),
        recentOrders,
    };
};
exports.vendorServices = {
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
