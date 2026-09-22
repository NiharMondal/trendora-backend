import { OrderStatus, Prisma } from "@/lib/prisma-client";
import { prisma } from "@/config/db";
import PrismaQueryBuilder from "@/lib/PrismaQueryBuilder";
import CustomError from "@/utils/customError";
import {
    TCreateVendorReview,
    TUpdateVendorReview,
} from "./vendor-review.validation";

/**
 * Store reviews, as opposed to product reviews (see modules/review).
 *
 * Only a buyer whose vendor order was actually DELIVERED can rate that store,
 * one review per vendor order — so ratings cannot be farmed. `Vendor.averageRating`
 * and `totalReviews` are denormalised counters recomputed inside the same
 * transaction as every write, which keeps store cards cheap to render.
 */

const recomputeVendorRating = async (
    tx: Prisma.TransactionClient,
    vendorId: string,
) => {
    const stats = await tx.vendorReview.aggregate({
        where: { vendorId, isDeleted: false },
        _avg: { rating: true },
        _count: { rating: true },
    });

    await tx.vendor.update({
        where: { id: vendorId },
        data: {
            averageRating: stats._avg.rating ?? null,
            totalReviews: stats._count.rating,
        },
    });
};

const createIntoDB = async (userId: string, payload: TCreateVendorReview) => {
    // The order is the proof of purchase — and where vendorId comes from.
    const vendorOrder = await prisma.vendorOrder.findUnique({
        where: { id: payload.vendorOrderId },
        include: { order: { select: { userId: true } } },
    });

    if (!vendorOrder) {
        throw new CustomError(404, "Order not found");
    }

    if (vendorOrder.order.userId !== userId) {
        throw new CustomError(403, "You can only review your own orders");
    }

    if (vendorOrder.orderStatus !== OrderStatus.DELIVERED) {
        throw new CustomError(
            400,
            "You can review a store once your order has been delivered",
        );
    }

    const existing = await prisma.vendorReview.findUnique({
        where: {
            userId_vendorOrderId: {
                userId,
                vendorOrderId: payload.vendorOrderId,
            },
        },
    });

    if (existing) {
        throw new CustomError(409, "You have already reviewed this order");
    }

    return prisma.$transaction(async (tx) => {
        const review = await tx.vendorReview.create({
            data: {
                vendorId: vendorOrder.vendorId,
                userId,
                vendorOrderId: payload.vendorOrderId,
                rating: payload.rating,
                comment: payload.comment,
            },
        });

        await recomputeVendorRating(tx, vendorOrder.vendorId);

        return review;
    });
};

/** Public: the reviews shown on a store page. */
const findByVendorSlug = async (
    slug: string,
    query: Record<string, unknown>,
) => {
    const vendor = await prisma.vendor.findFirst({
        where: { slug, isDeleted: false },
        select: { id: true },
    });

    if (!vendor) {
        throw new CustomError(404, "Store not found");
    }

    const builder = new PrismaQueryBuilder<Prisma.VendorReviewWhereInput>(
        query, { model: "VendorReview" });

    const prismaArgs = builder
        .withDefaultFilter({ vendorId: vendor.id, isDeleted: false })
        .search(["comment"])
        .filter()
        .paginate()
        .sort("createdAt", "desc")
        .include({
            user: { select: { name: true, avatar: true } },
        })
        .build();

    const [reviews, meta] = await Promise.all([
        prisma.vendorReview.findMany(prismaArgs),
        builder.getMeta(prisma.vendorReview),
    ]);

    return { meta, data: reviews };
};

/** The caller's own store reviews, for "my reviews" in the buyer dashboard. */
const findMine = async (userId: string) =>
    prisma.vendorReview.findMany({
        where: { userId, isDeleted: false },
        include: {
            vendor: { select: { id: true, storeName: true, slug: true, logo: true } },
            vendorOrder: { select: { id: true, vendorOrderNumber: true } },
        },
        orderBy: { createdAt: "desc" },
    });

const updateData = async (
    userId: string,
    reviewId: string,
    payload: TUpdateVendorReview,
) => {
    const review = await prisma.vendorReview.findFirst({
        where: { id: reviewId, isDeleted: false },
    });

    if (!review) {
        throw new CustomError(404, "Review not found");
    }

    if (review.userId !== userId) {
        throw new CustomError(403, "You can only edit your own review");
    }

    return prisma.$transaction(async (tx) => {
        const updated = await tx.vendorReview.update({
            where: { id: reviewId },
            data: {
                rating: payload.rating,
                comment: payload.comment,
            },
        });

        await recomputeVendorRating(tx, review.vendorId);

        return updated;
    });
};

/** Soft delete. The author may remove their own; an admin may remove any. */
const deleteData = async (
    actor: { id: string; role: string },
    reviewId: string,
) => {
    const review = await prisma.vendorReview.findFirst({
        where: { id: reviewId, isDeleted: false },
    });

    if (!review) {
        throw new CustomError(404, "Review not found");
    }

    if (actor.role !== "ADMIN" && review.userId !== actor.id) {
        throw new CustomError(403, "You can only delete your own review");
    }

    return prisma.$transaction(async (tx) => {
        const deleted = await tx.vendorReview.update({
            where: { id: reviewId },
            data: { isDeleted: true },
        });

        await recomputeVendorRating(tx, review.vendorId);

        return deleted;
    });
};

export const vendorReviewServices = {
    createIntoDB,
    findByVendorSlug,
    findMine,
    updateData,
    deleteData,
};
