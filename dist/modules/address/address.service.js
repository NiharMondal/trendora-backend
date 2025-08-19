"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addressServices = void 0;
const db_1 = require("../../config/db");
const customError_1 = __importDefault(require("../../utils/customError"));
const createIntoDB = async (payload) => {
    const address = await db_1.prisma.address.create({
        data: payload,
    });
    return address;
};
const findAddressByUserId = async (userId) => {
    const user = await db_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new customError_1.default(404, "Sorry, user not found!");
    }
    const addresses = await db_1.prisma.address.findMany({
        where: {
            userId: userId,
        },
    });
    return addresses;
};
const findById = async (id) => {
    const address = await db_1.prisma.address.findUniqueOrThrow({
        where: { id },
    });
    return address;
};
const updateData = async (id, payload) => {
    await db_1.prisma.address.findUniqueOrThrow({
        where: { id },
    });
    const updatedData = await db_1.prisma.address.update({
        where: { id },
        data: payload,
    });
    return updatedData;
};
const deleteData = async (id) => {
    await db_1.prisma.address.findUniqueOrThrow({
        where: { id },
    });
    const data = await db_1.prisma.address.delete({
        where: { id },
    });
    return data;
};
exports.addressServices = {
    createIntoDB,
    findAddressByUserId,
    findById,
    updateData,
    deleteData,
};
