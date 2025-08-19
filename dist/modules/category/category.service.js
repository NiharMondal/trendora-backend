"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryServices = void 0;
const db_1 = require("../../config/db");
const slug_1 = require("../../helpers/slug");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder"));
const createIntoDB = async (payload) => {
    const slug = (0, slug_1.generateSlug)(payload.name);
    const data = await db_1.prisma.category.create({
        data: { ...payload, slug },
    });
    return data;
};
const findAllFromDB = async (query) => {
    const builder = new PrismaQueryBuilder_1.default(query);
    const prismaArgs = builder.search(["name"]).filter().paginate().build();
    const category = await db_1.prisma.category.findMany(prismaArgs);
    const meta = await builder.getMeta(db_1.prisma.category);
    return { meta, category };
};
const findById = async (id) => {
    const category = await db_1.prisma.category.findUniqueOrThrow({
        where: { id },
    });
    return category;
};
const updateData = async (id, payload) => {
    const category = await db_1.prisma.category.findUniqueOrThrow({
        where: { id },
    });
    const slug = (0, slug_1.generateSlug)(payload.name || category.name);
    const updatedData = await db_1.prisma.category.update({
        where: { id },
        data: { ...payload, slug },
    });
    return updatedData;
};
const deleteData = async (id) => {
    await db_1.prisma.category.findUniqueOrThrow({
        where: { id },
    });
    const data = await db_1.prisma.category.update({
        where: { id },
        data: {
            isDeleted: true,
        },
    });
    return data;
};
exports.categoryServices = {
    createIntoDB,
    findAllFromDB,
    findById,
    updateData,
    deleteData,
};
