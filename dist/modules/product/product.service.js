"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.productServices = void 0;
const db_1 = require("../../config/db");
const slug_1 = require("../../helpers/slug");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder"));
const customError_1 = __importDefault(require("../../utils/customError"));
const createIntoDB = async (payload) => {
    const { variants, images, ...others } = payload;
    const slug = (0, slug_1.generateSlug)(payload.name);
    const data = await db_1.prisma.product.create({
        data: {
            ...others,
            slug,
            variants: {
                create: variants?.map((v) => ({
                    size: v.size,
                    color: v.color,
                    stock: v.stock,
                    price: v.price,
                })),
            },
            images: {
                create: images?.map((img) => ({
                    url: img.url,
                    isMain: img.isMain,
                })),
            },
        },
        include: {
            images: true,
            variants: true,
        },
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
        .build();
    const product = await db_1.prisma.product.findMany(prismaArgs);
    const meta = await builder.getMeta(db_1.prisma.product);
    return { meta, product };
};
const findById = async (id) => {
    const product = await db_1.prisma.product.findUniqueOrThrow({
        where: { id },
        include: {
            variants: true,
            images: true,
        },
    });
    return product;
};
const findBySlug = async (slug) => {
    const product = await db_1.prisma.product.findUniqueOrThrow({
        where: { slug },
        include: {
            variants: true,
            images: true,
        },
    });
    return product;
};
const updateData = async (id, payload) => {
    const { variants, images, ...rest } = payload;
    const product = await db_1.prisma.product.findUnique({ where: { id } });
    if (!product) {
        throw new customError_1.default(404, "Product not found!");
    }
    const slug = (0, slug_1.generateSlug)(rest.name || product.name);
    const updatedData = await db_1.prisma.product.update({
        where: { id },
        data: {
            ...rest,
            slug: slug,
            variants: {
                deleteMany: {},
                createMany: {
                    data: variants ? variants.map((v) => ({ ...v })) : [],
                },
            },
            images: {
                deleteMany: {},
                createMany: {
                    data: images ? images.map((v) => ({ ...v })) : [],
                },
            },
        },
        include: {
            variants: true,
            images: true,
        },
    });
    return updatedData;
};
const deleteData = async (id) => {
    await db_1.prisma.product.findUniqueOrThrow({
        where: { id },
    });
    const data = await db_1.prisma.product.update({
        where: { id },
        data: {
            isDeleted: true,
        },
    });
    return data;
};
exports.productServices = {
    createIntoDB,
    findAllFromDB,
    findById,
    findBySlug,
    updateData,
    deleteData,
};
