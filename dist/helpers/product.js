"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reopenModerationIfApproved = exports.assertPromoted = exports.promoteImages = exports.resolveViewableProduct = exports.resolveEditableProduct = exports.syncVariantStock = exports.liveVariants = void 0;
const db_1 = require("../config/db.js");
const prisma_client_1 = require("../lib/prisma-client.js");
const cloudinary_1 = require("../utils/cloudinary.js");
const customError_1 = __importDefault(require("../utils/customError.js"));
const vendor_1 = require("./vendor");
/**
 * Variants are SOFT deleted, so every read has to exclude them.
 *
 * `OrderItem.variantId` is `ON DELETE SET NULL` (see the init migration): hard
 * deleting a variant silently detaches it from every past order line that sold
 * it. `ProductVariant.isDeleted` exists for exactly this, the same way `Address`
 * is soft-deleted because `Order.shippingAddressId` points at it.
 *
 * Images carry no such reference and are hard deleted, because their Cloudinary
 * asset goes with them and a row pointing at a destroyed asset is worthless.
 */
exports.liveVariants = { where: { isDeleted: false } };
/**
 * For a product WITH live variants, `Product.stockQuantity` is derived: the sum
 * of its live variants' `stock`. Only a product with no variants owns the
 * column outright.
 *
 * A sale and a cancellation move the VARIANT's stock (`persistOrder`,
 * `updateVendorOrderStatus`), yet the storefront's `inStock` filter and every
 * dashboard stock column and sort read `stockQuantity`. Left alone the column
 * keeps whatever the product form last stamped on it, so a jacket with every
 * variant sold out still reads "200 in stock" and fails only at checkout
 * (`docs/FEATURE-GAPS.md` XR-13).
 *
 * Call it inside the same transaction as every write that changes a variant's
 * stock or liveness, AFTER that write — including any `product.update` that
 * carries a client-supplied `stockQuantity`, which this then overrides.
 * Products with no live variants are left untouched.
 */
const syncVariantStock = async (tx, productIds) => {
    const ids = [...new Set(productIds)];
    if (ids.length === 0)
        return;
    const totals = await tx.productVariant.groupBy({
        by: ["productId"],
        where: { productId: { in: ids }, isDeleted: false },
        _sum: { stock: true },
    });
    for (const total of totals) {
        await tx.product.update({
            where: { id: total.productId },
            data: { stockQuantity: total._sum.stock ?? 0 },
        });
    }
};
exports.syncVariantStock = syncVariantStock;
/**
 * The product a sub-resource WRITE applies to, or 404.
 *
 * 404 rather than 403, for the same reason `assertVendorOwnsProduct` does it:
 * another store's product ids must stay unguessable. An ADMIN may act on any
 * store's listing; a VENDOR only ever on their own, whatever id they send.
 */
const resolveEditableProduct = async (actor, productId) => {
    if (actor.role === prisma_client_1.Role.ADMIN) {
        const product = await db_1.prisma.product.findFirst({
            where: { id: productId, isDeleted: false },
        });
        if (!product) {
            throw new customError_1.default(404, "Product not found");
        }
        return product;
    }
    const vendorId = await (0, vendor_1.resolveVendorScope)(actor);
    return (0, vendor_1.assertVendorOwnsProduct)(vendorId, productId);
};
exports.resolveEditableProduct = resolveEditableProduct;
/**
 * The product a sub-resource READ applies to, gated by the storefront's three
 * visibility rules, or 404.
 *
 * These reads are public, so they must not become a side door onto a listing
 * `GET /products/:id` would 404 — a draft, an unpublished listing or one whose
 * store is suspended. A vendor editing their own draft reads it through
 * `/products/vendor/my-products/:id`, which returns both collections nested.
 */
const resolveViewableProduct = async (productId) => {
    const product = await db_1.prisma.product.findFirst({
        where: (0, vendor_1.publicProductFilter)({ id: productId }),
    });
    if (!product) {
        throw new customError_1.default(404, "Product not found");
    }
    return product;
};
exports.resolveViewableProduct = resolveViewableProduct;
/**
 * Promotes freshly uploaded assets out of the Cloudinary `temp/` staging
 * folder. Only assets still staged there are touched — that guard is what stops
 * an existing live image from being renamed away.
 */
const promoteImages = async (images) => Promise.all(images.map(async (img) => {
    if (!img.id && img.publicId.includes("/temp/")) {
        const { publicId, url } = await (0, cloudinary_1.moveFromTemp)(img.publicId);
        return { ...img, publicId, url };
    }
    return img;
}));
exports.promoteImages = promoteImages;
/**
 * A persisted publicId must never still be in `temp/`.
 *
 * `POST /cloudinary/delete-temp` is unauthenticated and deletes anything whose
 * publicId is under `temp/`. An image saved while still staged there is live on
 * the storefront with its publicId readable straight off the `<img src>`, so
 * anyone could delete it. See `docs/FEATURE-GAPS.md` BE-41.
 */
const assertPromoted = (images) => {
    const stuck = images.filter((img) => img.publicId.includes("/temp/"));
    if (stuck.length > 0) {
        throw new customError_1.default(500, "Image upload could not be finalised. Please try again.");
    }
};
exports.assertPromoted = assertPromoted;
/**
 * Imagery is a MATERIAL field (see `MATERIAL_FIELDS` in `product.service.ts`):
 * an approved listing whose pictures changed is effectively a new listing, so
 * it goes back in the moderation queue.
 *
 * Variants deliberately do NOT re-open moderation — a vendor has to be able to
 * restock and reprice without waiting on an admin, which is the same reason
 * `price` and `stockQuantity` are absent from `MATERIAL_FIELDS`. Neither does
 * setting a hero image or editing alt text: that is presentation of imagery a
 * moderator has already approved, not new imagery.
 */
const reopenModerationIfApproved = async (tx, product) => {
    if (product.status !== prisma_client_1.ProductStatus.APPROVED)
        return false;
    await tx.product.update({
        where: { id: product.id },
        data: {
            status: prisma_client_1.ProductStatus.PENDING,
            submittedAt: new Date(),
            approvedAt: null,
            rejectionReason: null,
        },
    });
    return true;
};
exports.reopenModerationIfApproved = reopenModerationIfApproved;
