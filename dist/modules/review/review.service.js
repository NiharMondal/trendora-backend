"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewServices = void 0;
const db_1 = require("../../config/db");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder"));
const customError_1 = __importDefault(require("../../utils/customError"));
const createIntoDB = async (payload) => {
    const user = await db_1.prisma.user.findUnique({
        where: { id: payload.userId },
    });
    if (!user) {
        throw new customError_1.default(404, "Sorry, User not found!");
    }
    const product = await db_1.prisma.product.findUnique({
        where: { id: payload.productId, isDeleted: false },
    });
    if (!product) {
        throw new customError_1.default(404, "Sorry, Product not found!");
    }
    const review = await db_1.prisma.review.create({
        data: payload,
    });
    return review;
};
const findAllFromDB = async (query) => {
    const builder = new PrismaQueryBuilder_1.default(query);
    const prismaArgs = builder.search(["comment"]).filter().paginate().build();
    const review = await db_1.prisma.review.findMany(prismaArgs);
    const meta = await builder.getMeta(db_1.prisma.review);
    return { meta, review };
};
const findById = async (id) => {
    const review = await db_1.prisma.review.findUniqueOrThrow({
        where: { id },
    });
    return review;
};
const findByUserId = async (id) => {
    const review = await db_1.prisma.review.findMany({
        where: { userId: id },
    });
    return review;
};
const updateData = async (id, payload) => {
    const updatedData = await db_1.prisma.review.update({
        where: { id },
        data: { ...payload },
    });
    return updatedData;
};
const deleteData = async (id) => {
    await db_1.prisma.review.findUniqueOrThrow({
        where: { id },
    });
    const data = await db_1.prisma.review.update({
        where: { id },
        data: {
            isDeleted: true,
        },
    });
    return data;
};
exports.reviewServices = {
    createIntoDB,
    findAllFromDB,
    findByUserId,
    findById,
    updateData,
    deleteData,
};
