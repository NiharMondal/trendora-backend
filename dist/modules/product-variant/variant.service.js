"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.variantServices = void 0;
const db_1 = require("../../config/db.js");
const product_1 = require("../../helpers/product.js");
const customError_1 = __importDefault(require("../../utils/customError.js"));
const variantInclude = {
    size: { select: { id: true, name: true } },
};
/** Every write answers with the whole refreshed collection. */
const listLive = (productId) => db_1.prisma.productVariant.findMany({
    where: { productId, isDeleted: false },
    include: variantInclude,
    orderBy: { createdAt: "asc" },
});
/**
 * A variant is identified by (size, colour). Two rows with the same pair are a
 * data error the DB does not prevent — the cart could not tell them apart.
 */
const assertNoDuplicates = async (productId, incoming, ignoreVariantId) => {
    const existing = await db_1.prisma.productVariant.findMany({
        where: {
            productId,
            isDeleted: false,
            ...(ignoreVariantId ? { id: { not: ignoreVariantId } } : {}),
        },
        select: { sizeId: true, color: true },
    });
    const key = (v) => `${v.sizeId ?? ""}:${v.color.trim().toLowerCase()}`;
    const seen = new Set(existing.map(key));
    for (const variant of incoming) {
        if (seen.has(key(variant))) {
            throw new customError_1.default(409, `This product already has a "${variant.color}" variant in that size`);
        }
        seen.add(key(variant));
    }
};
const findByProductId = async (productId) => {
    await (0, product_1.resolveViewableProduct)(productId);
    return listLive(productId);
};
/**
 * Add sizes/colours to an existing listing without resending the product.
 *
 * Deliberately does NOT re-open moderation: stock and pricing are a vendor's to
 * change without waiting on an admin — the same rule that keeps `price` and
 * `stockQuantity` out of `MATERIAL_FIELDS`.
 */
const addVariants = async (actor, productId, payload) => {
    await (0, product_1.resolveEditableProduct)(actor, productId);
    await assertNoDuplicates(productId, payload.variants);
    await db_1.prisma.productVariant.createMany({
        data: payload.variants.map((variant) => ({
            productId,
            sizeId: variant.sizeId ?? null,
            color: variant.color,
            stock: variant.stock,
            price: variant.price,
        })),
    });
    return listLive(productId);
};
const updateVariant = async (actor, productId, variantId, payload) => {
    await (0, product_1.resolveEditableProduct)(actor, productId);
    const variant = await db_1.prisma.productVariant.findFirst({
        where: { id: variantId, productId, isDeleted: false },
    });
    if (!variant) {
        throw new customError_1.default(404, "Variant not found");
    }
    // Only a change to the identifying pair can collide.
    if (payload.color !== undefined || payload.sizeId !== undefined) {
        await assertNoDuplicates(productId, [
            {
                sizeId: payload.sizeId !== undefined
                    ? payload.sizeId
                    : variant.sizeId,
                color: payload.color ?? variant.color,
            },
        ], variantId);
    }
    await db_1.prisma.productVariant.update({
        where: { id: variantId },
        data: {
            ...(payload.sizeId !== undefined
                ? { sizeId: payload.sizeId ?? null }
                : {}),
            ...(payload.color !== undefined ? { color: payload.color } : {}),
            ...(payload.stock !== undefined ? { stock: payload.stock } : {}),
            ...(payload.price !== undefined ? { price: payload.price } : {}),
        },
    });
    return listLive(productId);
};
/**
 * Soft delete. `OrderItem.variantId` is `ON DELETE SET NULL`, so removing the
 * row would detach every past order line that sold this variant from what it
 * sold. Reads exclude `isDeleted` rows (`liveVariants`), so it disappears from
 * the storefront and the dashboard just the same.
 */
const deleteVariant = async (actor, productId, variantId) => {
    await (0, product_1.resolveEditableProduct)(actor, productId);
    const removed = await db_1.prisma.productVariant.updateMany({
        where: { id: variantId, productId, isDeleted: false },
        data: { isDeleted: true },
    });
    if (removed.count === 0) {
        throw new customError_1.default(404, "Variant not found");
    }
    return listLive(productId);
};
exports.variantServices = {
    findByProductId,
    addVariants,
    updateVariant,
    deleteVariant,
};
