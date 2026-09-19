"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewServices = void 0;
const prisma_1 = require("../../../generated/prisma");
const db_1 = require("../../config/db");
const vendor_1 = require("../../helpers/vendor");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder"));
const customError_1 = __importDefault(require("../../utils/customError"));
/**
 * Recompute a product's denormalised rating counters. Called inside the same
 * transaction as every review write so `averageRating` / `totalReviews` on the
 * product card can never drift from the reviews themselves.
 */
const recomputeProductRating = async (tx, productId) => {
    const stats = await tx.review.aggregate({
        where: { productId, isDeleted: false },
        _avg: { rating: true },
        _count: { rating: true },
    });
    await tx.product.update({
        where: { id: productId },
        data: {
            averageRating: stats._avg.rating ?? null,
            totalReviews: stats._count.rating,
        },
    });
};
const createIntoDB = async (payload) => {
    const user = await db_1.prisma.user.findUnique({
        where: { id: payload.userId },
    });
    if (!user) {
        throw new customError_1.default(404, "Sorry, User not found!");
    }
    const product = await db_1.prisma.product.findFirst({
        where: (0, vendor_1.publicProductFilter)({ id: payload.productId }),
    });
    if (!product) {
        throw new customError_1.default(404, "Sorry, Product not found!");
    }
    const result = await db_1.prisma.$transaction(async (tx) => {
        const review = await tx.review.create({
            data: payload,
        });
        await recomputeProductRating(tx, payload.productId);
        return review;
    });
    return result;
};
const findAllFromDB = async (query) => {
    const builder = new PrismaQueryBuilder_1.default(query);
    const prismaArgs = builder
        .search(["comment"])
        .filter()
        .paginate()
        .sort("createdAt", "desc")
        .include({
        user: {
            select: {
                name: true,
                avatar: true,
            },
        },
    })
        .build();
    const [reviews, meta] = await Promise.all([
        db_1.prisma.review.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.review),
    ]);
    return { reviews, meta };
};
const findAllReviewsByProductId = async (productId) => {
    const reviews = await db_1.prisma.review.findMany({
        where: { productId, isDeleted: false },
        include: {
            user: {
                select: {
                    name: true,
                    avatar: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
        take: 10,
        skip: 0,
    });
    return reviews;
};
const findById = async (id) => {
    const review = await db_1.prisma.review.findUniqueOrThrow({
        where: { id },
        include: {
            user: {
                select: {
                    name: true,
                },
            },
        },
    });
    return review;
};
const findByUserId = async (id) => {
    const review = await db_1.prisma.review.findMany({
        where: { userId: id, isDeleted: false },
        include: {
            product: {
                select: {
                    name: true,
                    slug: true,
                    id: true,
                    images: true,
                },
            },
        },
    });
    return review;
};
const updateData = async (actor, id, payload) => {
    return await db_1.prisma.$transaction(async (tx) => {
        // Fetch existing review
        const existingReview = await tx.review.findUnique({
            where: { id, isDeleted: false },
        });
        if (!existingReview) {
            throw new customError_1.default(404, "Review not found");
        }
        // Only the author may edit their review (an admin may moderate any).
        if (actor.role !== prisma_1.Role.ADMIN &&
            existingReview.userId !== actor.id) {
            throw new customError_1.default(403, "You can only edit your own review");
        }
        const updatedReview = await tx.review.update({
            where: { id },
            // Never let the body reassign authorship or move the review to
            // another product.
            data: {
                rating: payload.rating,
                comment: payload.comment,
            },
        });
        await recomputeProductRating(tx, existingReview.productId);
        return updatedReview;
    });
};
const deleteData = async (actor, id) => {
    return await db_1.prisma.$transaction(async (tx) => {
        //  Fetch review
        const review = await tx.review.findUnique({
            where: { id, isDeleted: false },
        });
        if (!review) {
            throw new customError_1.default(404, "Review not found");
        }
        if (actor.role !== prisma_1.Role.ADMIN && review.userId !== actor.id) {
            throw new customError_1.default(403, "You can only delete your own review");
        }
        // Soft delete — this used to be a hard `delete` despite the comment,
        // which lost the audit trail and broke the isDeleted filters.
        const deletedReview = await tx.review.update({
            where: { id },
            data: { isDeleted: true },
        });
        await recomputeProductRating(tx, review.productId);
        return deletedReview;
    });
};
exports.reviewServices = {
    createIntoDB,
    findAllFromDB,
    findByUserId,
    findById,
    updateData,
    deleteData,
    findAllReviewsByProductId,
};
