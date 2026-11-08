"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.productImageServices = void 0;
const db_1 = require("../../config/db.js");
const product_1 = require("../../helpers/product.js");
const cloudinary_1 = require("../../utils/cloudinary.js");
const customError_1 = __importDefault(require("../../utils/customError.js"));
/** Every write answers with the whole refreshed collection. */
const listAll = (productId) => db_1.prisma.productImage.findMany({
    where: { productId },
    orderBy: [{ isMain: "desc" }, { id: "asc" }],
});
/**
 * Exactly one image is the hero. The column is a plain boolean with nothing
 * enforcing that, so whoever sets one has to clear the rest in the same
 * transaction.
 */
const makeSoleMain = async (tx, productId, imageId) => {
    await tx.productImage.updateMany({
        where: { productId, id: { not: imageId } },
        data: { isMain: false },
    });
    await tx.productImage.update({
        where: { id: imageId },
        data: { isMain: true },
    });
};
const findByProductId = async (productId) => {
    await (0, product_1.resolveViewableProduct)(productId);
    return listAll(productId);
};
/**
 * Add pictures to an existing listing without resending the product.
 *
 * Imagery IS material, so doing this to an approved listing sends it back to
 * PENDING — the same rule `PATCH /products/:id` applies. The moderation flip
 * and the inserts share one transaction, so a listing can never end up showing
 * unreviewed pictures while still marked APPROVED.
 */
const addImages = async (actor, productId, payload) => {
    const product = await (0, product_1.resolveEditableProduct)(actor, productId);
    // Outside the transaction: Cloudinary is a network round trip, and holding
    // a transaction open across one is the same mistake the refund helper
    // exists to avoid.
    const promoted = await (0, product_1.promoteImages)(payload.images);
    (0, product_1.assertPromoted)(promoted);
    const existingCount = await db_1.prisma.productImage.count({
        where: { productId },
    });
    // The first picture on a listing with none is the hero by default.
    const wantsMain = promoted.findIndex((img) => img.isMain);
    const mainIndex = wantsMain >= 0 ? wantsMain : existingCount === 0 ? 0 : undefined;
    const sentBackForReview = await db_1.prisma.$transaction(async (tx) => {
        for (const [index, image] of promoted.entries()) {
            const created = await tx.productImage.create({
                data: {
                    productId,
                    url: image.url,
                    publicId: image.publicId,
                    altText: image.altText,
                    isMain: false,
                },
            });
            if (index === mainIndex) {
                await makeSoleMain(tx, productId, created.id);
            }
        }
        return (0, product_1.reopenModerationIfApproved)(tx, product);
    });
    return { images: await listAll(productId), sentBackForReview };
};
/** Hero flag and alt text only — see `updateImageSchema`. */
const updateImage = async (actor, productId, imageId, payload) => {
    await (0, product_1.resolveEditableProduct)(actor, productId);
    const image = await db_1.prisma.productImage.findFirst({
        where: { id: imageId, productId },
    });
    if (!image) {
        throw new customError_1.default(404, "Image not found");
    }
    if (payload.isMain === false && image.isMain) {
        throw new customError_1.default(400, "A product needs a main image. Set another image as main instead.");
    }
    await db_1.prisma.$transaction(async (tx) => {
        if (payload.altText !== undefined) {
            await tx.productImage.update({
                where: { id: imageId },
                data: { altText: payload.altText ?? null },
            });
        }
        if (payload.isMain) {
            await makeSoleMain(tx, productId, imageId);
        }
    });
    return listAll(productId);
};
/**
 * Hard delete, plus the Cloudinary asset.
 *
 * Unlike a variant, nothing references an image, and a soft-deleted row
 * pointing at a destroyed asset is worthless. The asset is destroyed only after
 * the row is gone, so a Cloudinary failure cannot leave the listing showing a
 * picture that no longer exists.
 */
const deleteImage = async (actor, productId, imageId) => {
    const product = await (0, product_1.resolveEditableProduct)(actor, productId);
    const image = await db_1.prisma.productImage.findFirst({
        where: { id: imageId, productId },
    });
    if (!image) {
        throw new customError_1.default(404, "Image not found");
    }
    const remaining = await db_1.prisma.productImage.count({
        where: { productId, id: { not: imageId } },
    });
    // `productSchema` requires one image to create a listing; letting the last
    // one go would leave a product the storefront cannot render.
    if (remaining === 0) {
        throw new customError_1.default(400, "A product needs at least one image. Add a replacement before removing this one.");
    }
    const sentBackForReview = await db_1.prisma.$transaction(async (tx) => {
        await tx.productImage.delete({ where: { id: imageId } });
        // Never leave a listing with no hero.
        if (image.isMain) {
            const next = await tx.productImage.findFirst({
                where: { productId },
                orderBy: { id: "asc" },
            });
            if (next) {
                await makeSoleMain(tx, productId, next.id);
            }
        }
        return (0, product_1.reopenModerationIfApproved)(tx, product);
    });
    await (0, cloudinary_1.deleteFromCloudinary)(image.publicId);
    return { images: await listAll(productId), sentBackForReview };
};
exports.productImageServices = {
    findByProductId,
    addImages,
    updateImage,
    deleteImage,
};
