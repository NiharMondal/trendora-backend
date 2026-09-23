"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryServices = void 0;
const db_1 = require("../../config/db.js");
const slug_1 = require("../../helpers/slug.js");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder.js"));
const cloudinary_1 = require("../../utils/cloudinary.js");
const utils_1 = require("../../utils/utils.js");
/**
 * Turn the client's `{ url, publicId }` into the two columns that store it,
 * promoting the asset out of Cloudinary's `temp/` folder on the way.
 *
 * Three distinct cases, and conflating them loses data:
 *   `undefined` -> the field was not in the request; change nothing.
 *   `null`      -> the admin removed the picture; clear both columns.
 *   an object   -> set it, and destroy whatever it replaced.
 *
 * Only a publicId still containing `/temp/` is moved. A promoted asset is
 * live on the storefront, and renaming it again would break every URL already
 * rendered against it — the same guard the product and vendor services keep.
 */
const resolveImageColumns = async (image, previousPublicId) => {
    if (image === undefined)
        return {};
    if (image === null) {
        if (previousPublicId)
            await (0, cloudinary_1.deleteFromCloudinary)(previousPublicId);
        return { image: null, imagePublicId: null };
    }
    const stored = image.publicId.includes("/temp/")
        ? await (0, cloudinary_1.moveFromTemp)(image.publicId)
        : { url: image.url, publicId: image.publicId };
    // Unchanged image on an unrelated edit — nothing to clean up.
    if (previousPublicId && previousPublicId !== stored.publicId) {
        await (0, cloudinary_1.deleteFromCloudinary)(previousPublicId);
    }
    return { image: stored.url, imagePublicId: stored.publicId };
};
const createIntoDB = async (payload) => {
    // `image` arrives as a nested object; it maps onto two scalar columns, so
    // it must not reach Prisma inside the spread.
    const { image, ...rest } = payload;
    const name = (0, utils_1.capitalizeFirstLetter)(payload.name.trim());
    const slug = (0, slug_1.generateSlug)(payload.name);
    const data = await db_1.prisma.category.create({
        data: { ...rest, ...(await resolveImageColumns(image)), name, slug },
    });
    return data;
};
const findAllFromDB = async (query) => {
    const builder = new PrismaQueryBuilder_1.default(query, { model: "Category" });
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
    const { image, ...rest } = payload;
    const slug = (0, slug_1.generateSlug)(payload.name || category.name);
    const updatedData = await db_1.prisma.category.update({
        where: { id },
        data: {
            ...rest,
            ...(await resolveImageColumns(image, category.imagePublicId)),
            slug,
        },
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
