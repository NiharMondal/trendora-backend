"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertVendorOwnsVendorOrder = exports.assertVendorOwnsProduct = exports.vendorListScope = exports.resolveVendorScope = exports.requireApprovedVendor = exports.findVendorByOwner = exports.publicProductFilter = exports.publicVendorSelect = void 0;
const prisma_client_1 = require("../lib/prisma-client.js");
const db_1 = require("../config/db.js");
const customError_1 = __importDefault(require("../utils/customError.js"));
/**
 * Vendor scoping and ownership.
 *
 * `authGuard(...roles)` only answers "what role is this caller?" — it cannot
 * answer "does this row belong to them?". Every vendor-scoped read and write
 * must go through one of these helpers, otherwise any approved vendor could
 * mutate another vendor's products and orders by guessing an id.
 */
/** Columns of a Vendor that are safe to expose on public/storefront endpoints. */
exports.publicVendorSelect = {
    id: true,
    storeName: true,
    slug: true,
    description: true,
    logo: true,
    banner: true,
    averageRating: true,
    totalReviews: true,
    // Shipping terms are public on purpose: the storefront shows "free
    // delivery over X from this store", and the cart needs them to estimate
    // per-store shipping without re-fetching every product's vendor.
    shippingFee: true,
    freeShippingThreshold: true,
    createdAt: true,
};
/**
 * The filter that decides whether a product is visible to a shopper.
 *
 * Three gates, all required: admin moderation (`status`), the vendor's own
 * show/hide switch (`isPublished`), and the store being in good standing.
 * Always compose from this rather than hand-rolling the conditions, so a new
 * gate only has to be added in one place.
 */
const publicProductFilter = (extra = {}) => ({
    isDeleted: false,
    isPublished: true,
    status: "APPROVED",
    vendor: { status: prisma_client_1.VendorStatus.APPROVED, isDeleted: false },
    ...extra,
});
exports.publicProductFilter = publicProductFilter;
/** The store owned by this user, or null if they have not applied. */
const findVendorByOwner = async (userId) => db_1.prisma.vendor.findFirst({
    where: { ownerId: userId, isDeleted: false },
});
exports.findVendorByOwner = findVendorByOwner;
/**
 * The caller's store, guaranteed to be APPROVED.
 *
 * Throws 403 with an actionable message for every other state, so a suspended
 * vendor is never silently treated as having no store.
 */
const requireApprovedVendor = async (userId) => {
    const vendor = await (0, exports.findVendorByOwner)(userId);
    if (!vendor) {
        throw new customError_1.default(403, "You do not have a vendor account. Apply for one to start selling.");
    }
    switch (vendor.status) {
        case prisma_client_1.VendorStatus.APPROVED:
            return vendor;
        case prisma_client_1.VendorStatus.PENDING:
            throw new customError_1.default(403, "Your vendor application is still under review");
        case prisma_client_1.VendorStatus.REJECTED:
            throw new customError_1.default(403, vendor.rejectionReason
                ? `Your vendor application was rejected: ${vendor.rejectionReason}`
                : "Your vendor application was rejected");
        case prisma_client_1.VendorStatus.SUSPENDED:
            throw new customError_1.default(403, "Your store is suspended. Contact support to restore it.");
        default:
            throw new customError_1.default(403, "Your store is not active");
    }
};
exports.requireApprovedVendor = requireApprovedVendor;
/**
 * Resolves which vendor a write should apply to.
 *
 * An ADMIN acts on any store (`targetVendorId` required — being an admin is
 * not a licence to guess); a VENDOR always acts on their own, and any
 * `targetVendorId` they send is ignored rather than trusted.
 */
const resolveVendorScope = async (user, targetVendorId) => {
    if (user.role === prisma_client_1.Role.ADMIN) {
        if (!targetVendorId) {
            throw new customError_1.default(400, "vendorId is required when acting as an admin");
        }
        const vendor = await db_1.prisma.vendor.findFirst({
            where: { id: targetVendorId, isDeleted: false },
            select: { id: true },
        });
        if (!vendor) {
            throw new customError_1.default(404, "Vendor not found");
        }
        return vendor.id;
    }
    const vendor = await (0, exports.requireApprovedVendor)(user.id);
    return vendor.id;
};
exports.resolveVendorScope = resolveVendorScope;
/**
 * Restricts a list query to the caller's own store.
 *
 * ADMIN gets an unrestricted filter (optionally narrowed by `?vendorId=`);
 * everyone else is pinned to their own store, which is what keeps
 * `GET /products/vendor/my-products` from leaking another vendor's catalogue.
 */
const vendorListScope = async (user, requestedVendorId) => {
    if (user.role === prisma_client_1.Role.ADMIN) {
        return requestedVendorId ? { vendorId: requestedVendorId } : {};
    }
    const vendor = await (0, exports.requireApprovedVendor)(user.id);
    return { vendorId: vendor.id };
};
exports.vendorListScope = vendorListScope;
/**
 * Asserts the product exists and belongs to `vendorId`.
 *
 * Returns 404 rather than 403 when the product belongs to someone else: a
 * vendor should not be able to probe whether a competitor's product id exists.
 */
const assertVendorOwnsProduct = async (vendorId, productId) => {
    const product = await db_1.prisma.product.findFirst({
        where: { id: productId, vendorId, isDeleted: false },
    });
    if (!product) {
        throw new customError_1.default(404, "Product not found");
    }
    return product;
};
exports.assertVendorOwnsProduct = assertVendorOwnsProduct;
/** As above, for a vendor order (the fulfilment unit a vendor may act on). */
const assertVendorOwnsVendorOrder = async (vendorId, vendorOrderId) => {
    const vendorOrder = await db_1.prisma.vendorOrder.findFirst({
        where: { id: vendorOrderId, vendorId },
    });
    if (!vendorOrder) {
        throw new customError_1.default(404, "Order not found");
    }
    return vendorOrder;
};
exports.assertVendorOwnsVendorOrder = assertVendorOwnsVendorOrder;
