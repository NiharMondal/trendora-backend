import { Prisma, Role, VendorStatus } from "../../generated/prisma";
import { prisma } from "../config/db";
import CustomError from "../utils/customError";

/**
 * Vendor scoping and ownership.
 *
 * `authGuard(...roles)` only answers "what role is this caller?" — it cannot
 * answer "does this row belong to them?". Every vendor-scoped read and write
 * must go through one of these helpers, otherwise any approved vendor could
 * mutate another vendor's products and orders by guessing an id.
 */

/** Columns of a Vendor that are safe to expose on public/storefront endpoints. */
export const publicVendorSelect = {
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
} satisfies Prisma.VendorSelect;

/**
 * The filter that decides whether a product is visible to a shopper.
 *
 * Three gates, all required: admin moderation (`status`), the vendor's own
 * show/hide switch (`isPublished`), and the store being in good standing.
 * Always compose from this rather than hand-rolling the conditions, so a new
 * gate only has to be added in one place.
 */
export const publicProductFilter = (
    extra: Prisma.ProductWhereInput = {},
): Prisma.ProductWhereInput => ({
    isDeleted: false,
    isPublished: true,
    status: "APPROVED",
    vendor: { status: VendorStatus.APPROVED, isDeleted: false },
    ...extra,
});

/** The store owned by this user, or null if they have not applied. */
export const findVendorByOwner = async (userId: string) =>
    prisma.vendor.findFirst({
        where: { ownerId: userId, isDeleted: false },
    });

/**
 * The caller's store, guaranteed to be APPROVED.
 *
 * Throws 403 with an actionable message for every other state, so a suspended
 * vendor is never silently treated as having no store.
 */
export const requireApprovedVendor = async (userId: string) => {
    const vendor = await findVendorByOwner(userId);

    if (!vendor) {
        throw new CustomError(
            403,
            "You do not have a vendor account. Apply for one to start selling.",
        );
    }

    switch (vendor.status) {
        case VendorStatus.APPROVED:
            return vendor;
        case VendorStatus.PENDING:
            throw new CustomError(
                403,
                "Your vendor application is still under review",
            );
        case VendorStatus.REJECTED:
            throw new CustomError(
                403,
                vendor.rejectionReason
                    ? `Your vendor application was rejected: ${vendor.rejectionReason}`
                    : "Your vendor application was rejected",
            );
        case VendorStatus.SUSPENDED:
            throw new CustomError(
                403,
                "Your store is suspended. Contact support to restore it.",
            );
        default:
            throw new CustomError(403, "Your store is not active");
    }
};

/**
 * Resolves which vendor a write should apply to.
 *
 * An ADMIN acts on any store (`targetVendorId` required — being an admin is
 * not a licence to guess); a VENDOR always acts on their own, and any
 * `targetVendorId` they send is ignored rather than trusted.
 */
export const resolveVendorScope = async (
    user: { id: string; role: string },
    targetVendorId?: string,
): Promise<string> => {
    if (user.role === Role.ADMIN) {
        if (!targetVendorId) {
            throw new CustomError(
                400,
                "vendorId is required when acting as an admin",
            );
        }

        const vendor = await prisma.vendor.findFirst({
            where: { id: targetVendorId, isDeleted: false },
            select: { id: true },
        });

        if (!vendor) {
            throw new CustomError(404, "Vendor not found");
        }

        return vendor.id;
    }

    const vendor = await requireApprovedVendor(user.id);
    return vendor.id;
};

/**
 * Restricts a list query to the caller's own store.
 *
 * ADMIN gets an unrestricted filter (optionally narrowed by `?vendorId=`);
 * everyone else is pinned to their own store, which is what keeps
 * `GET /products/vendor/my-products` from leaking another vendor's catalogue.
 */
export const vendorListScope = async (
    user: { id: string; role: string },
    requestedVendorId?: string,
): Promise<Prisma.ProductWhereInput> => {
    if (user.role === Role.ADMIN) {
        return requestedVendorId ? { vendorId: requestedVendorId } : {};
    }

    const vendor = await requireApprovedVendor(user.id);
    return { vendorId: vendor.id };
};

/**
 * Asserts the product exists and belongs to `vendorId`.
 *
 * Returns 404 rather than 403 when the product belongs to someone else: a
 * vendor should not be able to probe whether a competitor's product id exists.
 */
export const assertVendorOwnsProduct = async (
    vendorId: string,
    productId: string,
) => {
    const product = await prisma.product.findFirst({
        where: { id: productId, vendorId, isDeleted: false },
    });

    if (!product) {
        throw new CustomError(404, "Product not found");
    }

    return product;
};

/** As above, for a vendor order (the fulfilment unit a vendor may act on). */
export const assertVendorOwnsVendorOrder = async (
    vendorId: string,
    vendorOrderId: string,
) => {
    const vendorOrder = await prisma.vendorOrder.findFirst({
        where: { id: vendorOrderId, vendorId },
    });

    if (!vendorOrder) {
        throw new CustomError(404, "Order not found");
    }

    return vendorOrder;
};
