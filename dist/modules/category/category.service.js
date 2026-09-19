"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryServices = void 0;
const db_1 = require("../../config/db");
const slug_1 = require("../../helpers/slug");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder"));
const utils_1 = require("../../utils/utils");
const createIntoDB = async (payload) => {
    const name = (0, utils_1.capitalizeFirstLetter)(payload.name.trim());
    const slug = (0, slug_1.generateSlug)(payload.name);
    const data = await db_1.prisma.category.create({
        data: { ...payload, name, slug },
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
        parent: {
            select: {
                id: true,
                name: true,
            },
        },
        sizeGroup: {
            select: {
                id: true,
                name: true,
            },
        },
    })
        .build();
    const [categories, meta] = await Promise.all([
        db_1.prisma.category.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.category),
    ]);
    return { meta, categories };
};
const findById = async (id) => {
    const category = await db_1.prisma.category.findUniqueOrThrow({
        where: { id },
        include: {
            parent: {
                select: { id: true, name: true },
            },
            sizeGroup: {
                select: {
                    sizes: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
        },
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
