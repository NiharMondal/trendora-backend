"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sizeGroupServices = void 0;
const db_1 = require("../../config/db");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder"));
const customError_1 = __importDefault(require("../../utils/customError"));
const createIntoDB = async (payload) => {
    const data = await db_1.prisma.sizeGroup.create({
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
    const [sizeGroups, meta] = await Promise.all([
        db_1.prisma.sizeGroup.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.sizeGroup),
    ]);
    return { meta, sizeGroups };
};
const findById = async (id) => {
    const sizeGroup = await db_1.prisma.sizeGroup.findUniqueOrThrow({
        where: { id },
    });
    if (sizeGroup.isDeleted) {
        throw new customError_1.default(400, "SizeGroup exist but status is deleted");
    }
    return sizeGroup;
};
const updateData = async (id, payload) => {
    await db_1.prisma.sizeGroup.findUniqueOrThrow({ where: { id } }); // find sizeGroup or throw error
    const updatedData = await db_1.prisma.sizeGroup.update({
        where: { id },
        data: payload,
    });
    return updatedData;
};
const deleteData = async (id) => {
    await db_1.prisma.sizeGroup.findUniqueOrThrow({
        where: { id },
    });
    const data = await db_1.prisma.sizeGroup.update({
        where: { id },
        data: {
            isDeleted: true,
        },
    });
    return data;
};
exports.sizeGroupServices = {
    createIntoDB,
    findAllFromDB,
    findById,
    updateData,
    deleteData,
};
