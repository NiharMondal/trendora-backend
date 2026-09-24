"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewServices = void 0;
const prisma_client_1 = require("../../lib/prisma-client.js");
const db_1 = require("../../config/db.js");
const vendor_1 = require("../../helpers/vendor.js");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder.js"));
const customError_1 = __importDefault(require("../../utils/customError.js"));
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
/**
 * Whether `userId` may review `productId` — the one rule, shared by the create
 * route and `GET /reviews/eligibility/:productId` so the UI and the server can
 * never disagree.
 *
 * A product review requires a DELIVERED parcel containing the product, bought
 * by this user: the same proof of purchase store reviews already demand
 * (`VendorReview` is tied to a delivered vendor order). Before this, any
 * signed-in account could review anything, any number of times (FE-21).
 *
 * One active review per user per product. Buying the same thing again does not
 * earn a second review — the buyer edits the one they have.
 */
const getEligibility = async (userId, productId) => {
    const existing = await db_1.prisma.review.findFirst({
        where: { userId, productId, isDeleted: false },
        select: { id: true },
    });
    if (existing) {
        return { canReview: false, reason: "ALREADY_REVIEWED", reviewId: existing.id };
    }
    const delivered = await db_1.prisma.orderItem.findFirst({
        where: {
            productId,
            order: { userId },
            vendorOrder: { orderStatus: prisma_client_1.OrderStatus.DELIVERED },
        },
        select: { id: true },
    });
    if (delivered)
        return { canReview: true, reason: null };
    // Bought but still on its way: worth a different message than "never bought".
    const inFlight = await db_1.prisma.orderItem.findFirst({
        where: {
            productId,
            order: { userId },
            vendorOrder: { orderStatus: { not: prisma_client_1.OrderStatus.CANCELED } },
        },
        select: { id: true },
    });
    return {
        canReview: false,
        reason: inFlight ? "NOT_DELIVERED" : "NOT_PURCHASED",
    };
};
const ELIGIBILITY_ERRORS = {
    ALREADY_REVIEWED: [409, "You have already reviewed this product — edit your review instead"],
    NOT_DELIVERED: [403, "You can review this product once your order has been delivered"],
    NOT_PURCHASED: [403, "Only buyers who have received this product can review it"],
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
    const eligibility = await getEligibility(payload.userId, payload.productId);
    if (!eligibility.canReview && eligibility.reason) {
        const [status, message] = ELIGIBILITY_ERRORS[eligibility.reason];
        throw new customError_1.default(status, message);
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
    const builder = new PrismaQueryBuilder_1.default(query, { model: "Review" });
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
        if (actor.role !== prisma_client_1.Role.ADMIN &&
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
        if (actor.role !== prisma_client_1.Role.ADMIN && review.userId !== actor.id) {
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
    getEligibility,
    createIntoDB,
    findAllFromDB,
    findByUserId,
    findById,
    updateData,
    deleteData,
    findAllReviewsByProductId,
};
