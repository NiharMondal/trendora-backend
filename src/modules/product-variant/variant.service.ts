import { prisma } from "@/config/db";
import {
    resolveEditableProduct,
    resolveViewableProduct,
    syncVariantStock,
    TActor,
} from "@/helpers/product";
import { Prisma } from "@/lib/prisma-client";
import CustomError from "@/utils/customError";

import { TAddVariants, TUpdateVariant } from "./variant.validation";

const variantInclude = {
    size: { select: { id: true, name: true } },
} satisfies Prisma.ProductVariantInclude;

/** Every write answers with the whole refreshed collection. */
const listLive = (productId: string) =>
    prisma.productVariant.findMany({
        where: { productId, isDeleted: false },
        include: variantInclude,
        orderBy: { createdAt: "asc" },
    });

/**
 * A variant is identified by (size, colour). Two rows with the same pair are a
 * data error the DB does not prevent — the cart could not tell them apart.
 */
const assertNoDuplicates = async (
    productId: string,
    incoming: { sizeId?: string | null; color: string }[],
    ignoreVariantId?: string,
) => {
    const existing = await prisma.productVariant.findMany({
        where: {
            productId,
            isDeleted: false,
            ...(ignoreVariantId ? { id: { not: ignoreVariantId } } : {}),
        },
        select: { sizeId: true, color: true },
    });

    const key = (v: { sizeId?: string | null; color: string }) =>
        `${v.sizeId ?? ""}:${v.color.trim().toLowerCase()}`;

    const seen = new Set(existing.map(key));

    for (const variant of incoming) {
        if (seen.has(key(variant))) {
            throw new CustomError(
                409,
                `This product already has a "${variant.color}" variant in that size`,
            );
        }
        seen.add(key(variant));
    }
};

const findByProductId = async (productId: string) => {
    await resolveViewableProduct(productId);

    return listLive(productId);
};

/**
 * Add sizes/colours to an existing listing without resending the product.
 *
 * Deliberately does NOT re-open moderation: stock and pricing are a vendor's to
 * change without waiting on an admin — the same rule that keeps `price` and
 * `stockQuantity` out of `MATERIAL_FIELDS`.
 */
const addVariants = async (
    actor: TActor,
    productId: string,
    payload: TAddVariants,
) => {
    await resolveEditableProduct(actor, productId);
    await assertNoDuplicates(productId, payload.variants);

    await prisma.$transaction(async (tx) => {
        await tx.productVariant.createMany({
            data: payload.variants.map((variant) => ({
                productId,
                sizeId: variant.sizeId ?? null,
                color: variant.color,
                stock: variant.stock,
                price: variant.price,
            })),
        });

        await syncVariantStock(tx, [productId]);
    });

    return listLive(productId);
};

const updateVariant = async (
    actor: TActor,
    productId: string,
    variantId: string,
    payload: TUpdateVariant,
) => {
    await resolveEditableProduct(actor, productId);

    const variant = await prisma.productVariant.findFirst({
        where: { id: variantId, productId, isDeleted: false },
    });

    if (!variant) {
        throw new CustomError(404, "Variant not found");
    }

    // Only a change to the identifying pair can collide.
    if (payload.color !== undefined || payload.sizeId !== undefined) {
        await assertNoDuplicates(
            productId,
            [
                {
                    sizeId:
                        payload.sizeId !== undefined
                            ? payload.sizeId
                            : variant.sizeId,
                    color: payload.color ?? variant.color,
                },
            ],
            variantId,
        );
    }

    await prisma.$transaction(async (tx) => {
        await tx.productVariant.update({
            where: { id: variantId },
            data: {
                ...(payload.sizeId !== undefined
                    ? { sizeId: payload.sizeId ?? null }
                    : {}),
                ...(payload.color !== undefined
                    ? { color: payload.color }
                    : {}),
                ...(payload.stock !== undefined
                    ? { stock: payload.stock }
                    : {}),
                ...(payload.price !== undefined
                    ? { price: payload.price }
                    : {}),
            },
        });

        await syncVariantStock(tx, [productId]);
    });

    return listLive(productId);
};

/**
 * Soft delete. `OrderItem.variantId` is `ON DELETE SET NULL`, so removing the
 * row would detach every past order line that sold this variant from what it
 * sold. Reads exclude `isDeleted` rows (`liveVariants`), so it disappears from
 * the storefront and the dashboard just the same.
 */
const deleteVariant = async (
    actor: TActor,
    productId: string,
    variantId: string,
) => {
    await resolveEditableProduct(actor, productId);

    await prisma.$transaction(async (tx) => {
        const removed = await tx.productVariant.updateMany({
            where: { id: variantId, productId, isDeleted: false },
            data: { isDeleted: true },
        });

        if (removed.count === 0) {
            throw new CustomError(404, "Variant not found");
        }

        const remaining = await tx.productVariant.count({
            where: { productId, isDeleted: false },
        });

        // Removing the last variant turns this back into a product that owns
        // its `stockQuantity`. The old figure was the variants' total — stock
        // that no longer exists — so it starts at 0 until the seller sets it.
        if (remaining === 0) {
            await tx.product.update({
                where: { id: productId },
                data: { stockQuantity: 0 },
            });
        } else {
            await syncVariantStock(tx, [productId]);
        }
    });

    return listLive(productId);
};

export const variantServices = {
    findByProductId,
    addVariants,
    updateVariant,
    deleteVariant,
};
