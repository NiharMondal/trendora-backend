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
/**
 * Runs a slide list query.
 *
 * `Slide` has no relations, so Prisma's `findMany` args have no `include` key
 * at all — the builder's is destructured away.
 */
const listSlides = async (query, defaultFilter) => {
    const builder = new PrismaQueryBuilder_1.default(query, {
        model: "Slide",
    });
    const { include: _include, ...prismaArgs } = builder
        .withDefaultFilter(defaultFilter)
        .search(["title", "subtitle"])
        .filter()
        .paginate()
        // `sortOrder` is the whole point of the column: it is the operator's
        // chosen display order, so it is the default sort rather than
        // `createdAt`. A caller can still override with `?sortBy=`.
        .sort("sortOrder", "asc")
        .build();
    const [slides, meta] = await Promise.all([
        db_1.prisma.slide.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.slide),
    ]);
    return { meta, slides };
};
/**
 * The storefront's slides. **Public**, so `isActive` is a hard filter rather
 * than a default a caller could override — otherwise `?isActive=false` would
 * hand anyone the banners an operator had deliberately taken down.
 *
 * Admins list the full set, including deactivated ones, via
 * `findAllForAdmin` — the same split as `GET /products` vs
 * `/products/admin/all`.
 */
const findAllFromDB = async (query) => listSlides(query, { isDeleted: false, isActive: true });
/**
 * ADMIN listing: every slide that has not been deleted, active or not.
 *
 * Without this, deactivating a slide would make it unreachable — the public
 * list hides it and there would be no other way to find it again.
 */
const findAllForAdmin = async (query) => listSlides(query, { isDeleted: false });
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
    findAllForAdmin,
    findById,
    updateData,
    deleteData,
};
