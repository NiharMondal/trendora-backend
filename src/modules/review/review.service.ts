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

    const review = await prisma.review.create({
        data: payload,
    });

    return review;
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
    const updatedData = await prisma.review.update({
        where: { id },
        data: { ...payload },
    });
    return updatedData;
};

const deleteData = async (id: string) => {
    await prisma.review.findUniqueOrThrow({
        where: { id },
    });
    const data = await prisma.review.update({
        where: { id },
        data: {
            isDeleted: true,
        },
    });

    return data;
};

export const reviewServices = {
    createIntoDB,
    findAllFromDB,
    findByUserId,
    findById,
    updateData,
    deleteData,
};
