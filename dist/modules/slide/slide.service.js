"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.slideServices = void 0;
const db_1 = require("../../config/db.js");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder.js"));
const customError_1 = __importDefault(require("../../utils/customError.js"));
const cloudinary_1 = require("../../utils/cloudinary.js");
/**
 * Turn the client's `{ url, publicId }` into the two columns that store it,
 * promoting a Cloudinary upload out of `temp/` on the way — the same shape as
 * `resolveImageColumns` in the category service.
 *
 * A slide is live on the storefront hero, and a publicId still containing
 * `/temp/` is deletable by anyone through the unauthenticated
 * `/cloudinary/delete-temp` (BE-41), so a save must never persist one.
 *
 *   `undefined`    -> not in the request; change nothing.
 *   empty publicId -> an image hosted elsewhere; store the URL, no publicId.
 *   an object      -> set it, and destroy the Cloudinary asset it replaced.
 */
const resolvePhotoColumns = async (photo, previousPublicId) => {
    if (photo === undefined)
        return {};
    const stored = !photo.publicId
        ? { url: photo.url, publicId: null }
        : photo.publicId.includes("/temp/")
            ? await (0, cloudinary_1.moveFromTemp)(photo.publicId)
            : { url: photo.url, publicId: photo.publicId };
    // Unchanged photo on an unrelated edit — nothing to clean up.
    if (previousPublicId && previousPublicId !== stored.publicId) {
        await (0, cloudinary_1.deleteFromCloudinary)(previousPublicId);
    }
    return { photoUrl: stored.url, photoPublicId: stored.publicId };
};
const createIntoDB = async (payload) => {
    // `photo` is a nested object mapping onto two scalar columns, so it must
    // not reach Prisma inside the spread.
    const { photo, ...rest } = payload;
    const data = await db_1.prisma.slide.create({
        data: {
            ...rest,
            photoUrl: photo.url,
            ...(await resolvePhotoColumns(photo)),
        },
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
 * `isActive` and `sortOrder` are applied since BE-16: the public list hard-filters
 * `isActive`, and both lists sort by `sortOrder`.
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
    const slide = await db_1.prisma.slide.findUniqueOrThrow({ where: { id } });
    const { photo, ...rest } = payload;
    const updatedData = await db_1.prisma.slide.update({
        where: { id },
        data: {
            ...rest,
            ...(await resolvePhotoColumns(photo, slide.photoPublicId)),
        },
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
