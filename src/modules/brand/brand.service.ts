import { Brand, Prisma } from "../../../generated/prisma";
import { prisma } from "../../config/db";
import PrismaQueryBuilder from "../../lib/PrismaQueryBuilder";
import CustomError from "../../utils/customError";

const createIntoDB = async (payload: Brand) => {
    const data = await prisma.brand.create({
        data: payload,
    });

    return data;
};

const findAllFromDB = async (query: Record<string, unknown>) => {
    const builder = new PrismaQueryBuilder<Prisma.BrandWhereInput>(query);

    const prismaArgs = builder
        .withDefaultFilter({ isDeleted: false })
        .search(["name"])
        .filter()
        .paginate()
        .build();

    const brand = await prisma.brand.findMany(prismaArgs);
    const meta = await builder.getMeta(prisma.brand);

    return { meta, brand };
};

const findById = async (id: string) => {
    const brand = await prisma.brand.findUniqueOrThrow({
        where: { id },
    });

    if (brand.isDeleted) {
        throw new CustomError(400, "Brand exist but status is deleted");
    }

    return brand;
};

const updateData = async (id: string, payload: Brand) => {
    await prisma.brand.findUniqueOrThrow({ where: { id } }); // find brand or throw error

    const updatedData = await prisma.brand.update({
        where: { id },
        data: payload,
    });
    return updatedData;
};

const deleteData = async (id: string) => {
    await prisma.brand.findUniqueOrThrow({
        where: { id },
    });
    const data = await prisma.brand.update({
        where: { id },
        data: {
            isDeleted: true,
        },
    });

    return data;
};

export const brandServices = {
    createIntoDB,
    findAllFromDB,
    findById,
    updateData,
    deleteData,
};
