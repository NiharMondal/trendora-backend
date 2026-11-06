import { prisma } from "@/config/db";
import {
    assertPromoted,
    promoteImages,
    reopenModerationIfApproved,
    resolveEditableProduct,
    resolveViewableProduct,
    TActor,
} from "@/helpers/product";
import { Prisma } from "@/lib/prisma-client";
import { deleteFromCloudinary } from "@/utils/cloudinary";
import CustomError from "@/utils/customError";

import { TAddImages, TUpdateImage } from "./image.validation";

/** Every write answers with the whole refreshed collection. */
const listAll = (productId: string) =>
    prisma.productImage.findMany({
        where: { productId },
        orderBy: [{ isMain: "desc" }, { id: "asc" }],
    });

/**
 * Exactly one image is the hero. The column is a plain boolean with nothing
 * enforcing that, so whoever sets one has to clear the rest in the same
 * transaction.
 */
const makeSoleMain = async (
    tx: Prisma.TransactionClient,
    productId: string,
    imageId: string,
) => {
    await tx.productImage.updateMany({
        where: { productId, id: { not: imageId } },
        data: { isMain: false },
    });
    await tx.productImage.update({
        where: { id: imageId },
        data: { isMain: true },
    });
};

const findByProductId = async (productId: string) => {
    await resolveViewableProduct(productId);

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
const addImages = async (
    actor: TActor,
    productId: string,
    payload: TAddImages,
) => {
    const product = await resolveEditableProduct(actor, productId);

    // Outside the transaction: Cloudinary is a network round trip, and holding
    // a transaction open across one is the same mistake the refund helper
    // exists to avoid.
    const promoted = await promoteImages(payload.images);
    assertPromoted(promoted);

    const existingCount = await prisma.productImage.count({
        where: { productId },
    });

    // The first picture on a listing with none is the hero by default.
    const wantsMain = promoted.findIndex((img) => img.isMain);
    const mainIndex =
        wantsMain >= 0 ? wantsMain : existingCount === 0 ? 0 : undefined;

    const sentBackForReview = await prisma.$transaction(async (tx) => {
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

        return reopenModerationIfApproved(tx, product);
    });

    return { images: await listAll(productId), sentBackForReview };
};

/** Hero flag and alt text only — see `updateImageSchema`. */
const updateImage = async (
    actor: TActor,
    productId: string,
    imageId: string,
    payload: TUpdateImage,
) => {
    await resolveEditableProduct(actor, productId);

    const image = await prisma.productImage.findFirst({
        where: { id: imageId, productId },
    });

    if (!image) {
        throw new CustomError(404, "Image not found");
    }

    if (payload.isMain === false && image.isMain) {
        throw new CustomError(
            400,
            "A product needs a main image. Set another image as main instead.",
        );
    }

    await prisma.$transaction(async (tx) => {
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
const deleteImage = async (
    actor: TActor,
    productId: string,
    imageId: string,
) => {
    const product = await resolveEditableProduct(actor, productId);

    const image = await prisma.productImage.findFirst({
        where: { id: imageId, productId },
    });

    if (!image) {
        throw new CustomError(404, "Image not found");
    }

    const remaining = await prisma.productImage.count({
        where: { productId, id: { not: imageId } },
    });

    // `productSchema` requires one image to create a listing; letting the last
    // one go would leave a product the storefront cannot render.
    if (remaining === 0) {
        throw new CustomError(
            400,
            "A product needs at least one image. Add a replacement before removing this one.",
        );
    }

    const sentBackForReview = await prisma.$transaction(async (tx) => {
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

        return reopenModerationIfApproved(tx, product);
    });

    await deleteFromCloudinary(image.publicId);

    return { images: await listAll(productId), sentBackForReview };
};

export const productImageServices = {
    findByProductId,
    addImages,
    updateImage,
    deleteImage,
};
