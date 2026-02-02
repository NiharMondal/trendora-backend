import { Prisma, Review } from "../../../generated/prisma";
import { prisma } from "../../config/db";
import PrismaQueryBuilder from "../../lib/PrismaQueryBuilder";
import CustomError from "../../utils/customError";

const createIntoDB = async (payload: Review) => {
    const user = await prisma.user.findUnique({
        where: { id: payload.userId },
    });

    if (!user) {
        throw new CustomError(404, "Sorry, User not found!");
    }
    const product = await prisma.product.findUnique({
        where: { id: payload.productId, isDeleted: false },
    });

    if (!product) {
        throw new CustomError(404, "Sorry, Product not found!");
    }

    const result = await prisma.$transaction(async (tx) => {
        const review = await tx.review.create({
            data: payload,
        });

        const ratingStats = await tx.review.aggregate({
            where: { productId: payload.productId },
            _avg: { rating: true },
            _count: { rating: true },
        });
        await tx.product.update({
            where: {
                id: payload.productId,
            },
            data: {
                averageRating: ratingStats._avg.rating ?? 0,
            },
        });

        return review;
    });

    return result;
};

const findAllFromDB = async (query: Record<string, unknown>) => {
    const builder = new PrismaQueryBuilder<Prisma.ReviewWhereInput>(query);

    const prismaArgs = builder
        .search(["comment"])
        .filter()
        .paginate()
        .include({
            user: {
                select: {
                    name: true,
                    avatar: true,
                },
            },
        })
        .build();

    const review = await prisma.review.findMany(prismaArgs);
    const meta = await builder.getMeta(prisma.review);

    return { meta, review };
};

const findById = async (id: string) => {
    const review = await prisma.review.findUniqueOrThrow({
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
const findByUserId = async (id: string) => {
    const review = await prisma.review.findMany({
        where: { userId: id },
    });

    return review;
};

const updateData = async (id: string, payload: Partial<Review>) => {
    return await prisma.$transaction(async (tx) => {
        // Fetch existing review
        const existingReview = await tx.review.findUnique({
            where: { id, isDeleted: false },
        });

        if (!existingReview) {
            throw new CustomError(404, "Review not found");
        }

        const updatedReview = await tx.review.update({
            where: { id },
            data: payload,
        });

        // Recalculate rating
        const stats = await tx.review.aggregate({
            where: {
                productId: existingReview.productId,
                isDeleted: false,
            },
            _avg: { rating: true },
            _count: { rating: true },
        });

        // Update product
        await tx.product.update({
            where: { id: existingReview.productId },
            data: {
                averageRating: stats._avg.rating ?? 0,
            },
        });

        return updatedReview;
    });
};

const deleteData = async (id: string) => {
    return await prisma.$transaction(async (tx) => {
        //  Fetch review
        const review = await tx.review.findUnique({
            where: { id, isDeleted: false },
        });

        if (!review) {
            throw new CustomError(404, "Review not found");
        }

        // Soft delete
        const deletedReview = await tx.review.update({
            where: { id },
            data: { isDeleted: true },
        });

        //  Recalculate product rating
        const stats = await tx.review.aggregate({
            where: {
                productId: review.productId,
                isDeleted: false,
            },
            _avg: { rating: true },
            _count: { rating: true },
        });

        // Update product
        await tx.product.update({
            where: { id: review.productId },
            data: {
                averageRating: stats._avg.rating ?? 0,
            },
        });

        return deletedReview;
    });
};

export const reviewServices = {
    createIntoDB,
    findAllFromDB,
    findByUserId,
    findById,
    updateData,
    deleteData,
};
