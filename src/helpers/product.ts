import { prisma } from "@/config/db";
import { Prisma, Product, ProductStatus, Role } from "@/lib/prisma-client";
import { moveFromTemp } from "@/utils/cloudinary";
import CustomError from "@/utils/customError";
import {
    assertVendorOwnsProduct,
    publicProductFilter,
    resolveVendorScope,
} from "./vendor";

export type TActor = { id: string; role: string };

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
export const liveVariants = { where: { isDeleted: false } } satisfies {
    where: Prisma.ProductVariantWhereInput;
};

/**
 * The product a sub-resource WRITE applies to, or 404.
 *
 * 404 rather than 403, for the same reason `assertVendorOwnsProduct` does it:
 * another store's product ids must stay unguessable. An ADMIN may act on any
 * store's listing; a VENDOR only ever on their own, whatever id they send.
 */
export const resolveEditableProduct = async (
    actor: TActor,
    productId: string,
): Promise<Product> => {
    if (actor.role === Role.ADMIN) {
        const product = await prisma.product.findFirst({
            where: { id: productId, isDeleted: false },
        });

        if (!product) {
            throw new CustomError(404, "Product not found");
        }

        return product;
    }

    const vendorId = await resolveVendorScope(actor);
    return assertVendorOwnsProduct(vendorId, productId);
};

/**
 * The product a sub-resource READ applies to, gated by the storefront's three
 * visibility rules, or 404.
 *
 * These reads are public, so they must not become a side door onto a listing
 * `GET /products/:id` would 404 — a draft, an unpublished listing or one whose
 * store is suspended. A vendor editing their own draft reads it through
 * `/products/vendor/my-products/:id`, which returns both collections nested.
 */
export const resolveViewableProduct = async (
    productId: string,
): Promise<Product> => {
    const product = await prisma.product.findFirst({
        where: publicProductFilter({ id: productId }),
    });

    if (!product) {
        throw new CustomError(404, "Product not found");
    }

    return product;
};

/**
 * Promotes freshly uploaded assets out of the Cloudinary `temp/` staging
 * folder. Only assets still staged there are touched — that guard is what stops
 * an existing live image from being renamed away.
 */
export const promoteImages = async <
    T extends { id?: string; url: string; publicId: string },
>(
    images: T[],
): Promise<T[]> =>
    Promise.all(
        images.map(async (img) => {
            if (!img.id && img.publicId.includes("/temp/")) {
                const { publicId, url } = await moveFromTemp(img.publicId);
                return { ...img, publicId, url };
            }
            return img;
        }),
    );

/**
 * A persisted publicId must never still be in `temp/`.
 *
 * `POST /cloudinary/delete-temp` is unauthenticated and deletes anything whose
 * publicId is under `temp/`. An image saved while still staged there is live on
 * the storefront with its publicId readable straight off the `<img src>`, so
 * anyone could delete it. See `docs/FEATURE-GAPS.md` BE-41.
 */
export const assertPromoted = (images: { publicId: string }[]) => {
    const stuck = images.filter((img) => img.publicId.includes("/temp/"));

    if (stuck.length > 0) {
        throw new CustomError(
            500,
            "Image upload could not be finalised. Please try again.",
        );
    }
};

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
export const reopenModerationIfApproved = async (
    tx: Prisma.TransactionClient,
    product: Product,
) => {
    if (product.status !== ProductStatus.APPROVED) return false;

    await tx.product.update({
        where: { id: product.id },
        data: {
            status: ProductStatus.PENDING,
            submittedAt: new Date(),
            approvedAt: null,
            rejectionReason: null,
        },
    });

    return true;
};
