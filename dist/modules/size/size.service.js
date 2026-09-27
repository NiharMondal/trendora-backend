"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sizeServices = void 0;
const db_1 = require("../../config/db.js");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder.js"));
const customError_1 = __importDefault(require("../../utils/customError.js"));
const createIntoDB = async (payload) => {
    const data = await db_1.prisma.size.create({
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
        .include({
        sizeGroup: {
            select: {
                id: true,
                name: true,
            },
        },
    })
        .build();
    const sizes = await db_1.prisma.size.findMany(prismaArgs);
    const meta = await builder.getMeta(db_1.prisma.size);
    return { meta, sizes };
};
const findById = async (id) => {
    const size = await db_1.prisma.size.findUniqueOrThrow({
        where: { id },
    });
    if (size.isDeleted) {
        throw new customError_1.default(400, "Size exist but status is deleted");
    }
    return size;
};
const updateData = async (id, payload) => {
    await db_1.prisma.size.findUniqueOrThrow({ where: { id } }); // find size or throw error
    const updatedData = await db_1.prisma.size.update({
        where: { id },
        data: payload,
    });
    return updatedData;
};
const deleteData = async (id) => {
    await db_1.prisma.size.findUniqueOrThrow({
        where: { id },
    });
    const data = await db_1.prisma.size.update({
        where: { id },
        data: {
            isDeleted: true,
        },
    });
    return data;
};
exports.sizeServices = {
    createIntoDB,
    findAllFromDB,
    findById,
    updateData,
    deleteData,
};
