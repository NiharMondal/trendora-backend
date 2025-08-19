"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wishlistServices = void 0;
const db_1 = require("../../config/db");
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
    const sameData = await db_1.prisma.wishlist.findFirst({
        where: { productId: payload.productId },
    });
    if (sameData) {
        throw new customError_1.default(400, "Sorry, This product already exist");
    }
    const data = await db_1.prisma.wishlist.create({
        data: payload,
    });
    return data;
};
const findByUserId = async (id) => {
    const myWishLists = await db_1.prisma.wishlist.findMany({
        where: {
            userId: id,
        },
    });
    return myWishLists;
};
const findById = async (id) => {
    const wishlist = await db_1.prisma.wishlist.findUniqueOrThrow({
        where: { id },
    });
    return wishlist;
};
const deleteData = async (id) => {
    const wishlist = await db_1.prisma.wishlist.delete({
        where: { id },
    });
    return wishlist;
};
exports.wishlistServices = {
    createIntoDB,
    findByUserId,
    findById,
    deleteData,
};
