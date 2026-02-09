import { Category, Prisma } from "../../../generated/prisma";
import { prisma } from "../../config/db";
import { generateSlug } from "../../helpers/slug";
import PrismaQueryBuilder from "../../lib/PrismaQueryBuilder";
import { capitalizeFirstLetter } from "../../utils/utils";

const createIntoDB = async (payload: Category) => {
    const name = capitalizeFirstLetter(payload.name.trim());
    const slug = generateSlug(payload.name);

    const data = await prisma.category.create({
        data: { ...payload, name, slug },
    });

    return data;
};

const findAllFromDB = async (query: Record<string, unknown>) => {
    const builder = new PrismaQueryBuilder<Prisma.CategoryWhereInput>(query, {
        defaultField: "createdAt",
        defaultOrder: "desc",
        allowedFields: ["name", "createdAt"],
    });

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
        })
        .build();

    const [categories, meta] = await Promise.all([
        prisma.category.findMany(prismaArgs),
        builder.getMeta(prisma.category),
    ]);

    return { meta, categories };
};

const findById = async (id: string) => {
    const category = await prisma.category.findUniqueOrThrow({
        where: { id },
    });

    return category;
};

const updateData = async (id: string, payload: Partial<Category>) => {
    const category = await prisma.category.findUniqueOrThrow({
        where: { id },
    });

    const slug = generateSlug(payload.name || category.name);

    const updatedData = await prisma.category.update({
        where: { id },
        data: { ...payload, slug },
    });
    return updatedData;
};

const deleteData = async (id: string) => {
    await prisma.category.findUniqueOrThrow({
        where: { id },
    });
    const data = await prisma.category.update({
        where: { id },
        data: {
            isDeleted: true,
        },
    });

    return data;
};

export const categoryServices = {
    createIntoDB,
    findAllFromDB,
    findById,
    updateData,
    deleteData,
};
