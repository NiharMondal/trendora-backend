import { Slide, Prisma } from "../../../generated/prisma";
import { prisma } from "../../config/db";
import PrismaQueryBuilder from "../../lib/PrismaQueryBuilder";
import CustomError from "../../utils/customError";

const createIntoDB = async (payload: Slide) => {
    const data = await prisma.slide.create({
        data: payload,
    });

    return data;
};

const findAllFromDB = async (query: Record<string, unknown>) => {
    const builder = new PrismaQueryBuilder<Prisma.SlideWhereInput>(query);

    const prismaArgs = builder
        .withDefaultFilter({ isDeleted: false })
        .search(["title"])
        .filter()
        .paginate()
        .build();

    const slide = await prisma.slide.findMany(prismaArgs);
    const meta = await builder.getMeta(prisma.slide);

    return { meta, slide };
};

const findById = async (id: string) => {
    const slide = await prisma.slide.findUniqueOrThrow({
        where: { id },
    });

    if (slide.isDeleted) {
        throw new CustomError(400, "Slide exist but status is deleted");
    }

    return slide;
};

const updateData = async (id: string, payload: Slide) => {
    await prisma.slide.findUniqueOrThrow({ where: { id } }); // find slide or throw error

    const updatedData = await prisma.slide.update({
        where: { id },
        data: payload,
    });
    return updatedData;
};

const deleteData = async (id: string) => {
    await prisma.slide.findUniqueOrThrow({
        where: { id },
    });
    const data = await prisma.slide.update({
        where: { id },
        data: {
            isDeleted: true,
        },
    });

    return data;
};

export const slideServices = {
    createIntoDB,
    findAllFromDB,
    findById,
    updateData,
    deleteData,
};
