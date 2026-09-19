"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.brandServices = void 0;
const db_1 = require("../../config/db");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder"));
const customError_1 = __importDefault(require("../../utils/customError"));
const createIntoDB = async (payload) => {
    const data = await db_1.prisma.brand.create({
        data: payload,
    });
    return data;
};
const findAllFromDB = async (query) => {
    const builder = new PrismaQueryBuilder_1.default(query);
    const prismaArgs = builder
        .withDefaultFilter({ isDeleted: false })
        .search(["name"])
        .filter()
        .paginate()
        .sort()
        .build();
    const [brand, meta] = await Promise.all([
        await db_1.prisma.brand.findMany(prismaArgs),
        await builder.getMeta(db_1.prisma.brand),
    ]);
    return { meta, brand };
};
const findById = async (id) => {
    const brand = await db_1.prisma.brand.findUniqueOrThrow({
        where: { id },
    });
    if (brand.isDeleted) {
        throw new customError_1.default(400, "Brand exist but status is deleted");
    }
    return brand;
};
const updateData = async (id, payload) => {
    await db_1.prisma.brand.findUniqueOrThrow({ where: { id } }); // find brand or throw error
    const updatedData = await db_1.prisma.brand.update({
        where: { id },
        data: payload,
    });
    return updatedData;
};
const deleteData = async (id) => {
    await db_1.prisma.brand.findUniqueOrThrow({
        where: { id },
    });
    const data = await db_1.prisma.brand.update({
        where: { id },
        data: {
            isDeleted: true,
        },
    });
    return data;
};
exports.brandServices = {
    createIntoDB,
    findAllFromDB,
    findById,
    updateData,
    deleteData,
};
