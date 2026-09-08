"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.slideServices = void 0;
const db_1 = require("../../config/db");
const customError_1 = __importDefault(require("../../utils/customError"));
const createIntoDB = async (payload) => {
    const data = await db_1.prisma.slide.create({
        data: payload,
    });
    return data;
};
const findAllFromDB = async () => {
    const slide = await db_1.prisma.slide.findMany({
        take: 4,
        orderBy: {
            createdAt: "desc",
        },
    });
    return slide;
};
const findById = async (id) => {
    const slide = await db_1.prisma.slide.findUniqueOrThrow({
        where: { id },
    });
    if (slide.isDeleted) {
        throw new customError_1.default(400, "Slide exist but status is deleted");
    }
    return slide;
};
const updateData = async (id, payload) => {
    await db_1.prisma.slide.findUniqueOrThrow({ where: { id } }); // find slide or throw error
    const updatedData = await db_1.prisma.slide.update({
        where: { id },
        data: payload,
    });
    return updatedData;
};
const deleteData = async (id) => {
    await db_1.prisma.slide.findUniqueOrThrow({
        where: { id },
    });
    const data = await db_1.prisma.slide.update({
        where: { id },
        data: {
            isDeleted: true,
        },
    });
    return data;
};
exports.slideServices = {
    createIntoDB,
    findAllFromDB,
    findById,
    updateData,
    deleteData,
};
