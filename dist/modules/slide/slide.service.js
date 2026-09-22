"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.slideServices = void 0;
const db_1 = require("../../config/db.js");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder.js"));
const customError_1 = __importDefault(require("../../utils/customError.js"));
const createIntoDB = async (payload) => {
    const data = await db_1.prisma.slide.create({
        data: payload,
    });
    return data;
};
/**
 * Hero slides.
 *
 * Was a hardcoded `take: 4` that ignored the caller's `limit` entirely — the
 * storefront slider asks for 5 and silently got 4. Now paginated like every
 * other list, so the request is honoured.
 *
 * `isActive` and `sortOrder` are still not applied — that is BE-16.
 */
const findAllFromDB = async (query) => {
    const builder = new PrismaQueryBuilder_1.default(query, {
        model: "Slide",
    });
    // `Slide` has no relations, so Prisma's findMany args have no `include`
    // key at all — drop the builder's before handing them over.
    const { include: _include, ...prismaArgs } = builder
        .withDefaultFilter({ isDeleted: false })
        .filter()
        .paginate()
        .sort()
        .build();
    const [slides, meta] = await Promise.all([
        db_1.prisma.slide.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.slide),
    ]);
    return { meta, slides };
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
