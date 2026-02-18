import { Prisma, Size } from "../../../generated/prisma";
import { prisma } from "../../config/db";
import PrismaQueryBuilder from "../../lib/PrismaQueryBuilder";
import CustomError from "../../utils/customError";

const createIntoDB = async (payload: Size) => {
	const data = await prisma.size.create({
		data: payload,
	});

	return data;
};

const findAllFromDB = async (query: Record<string, unknown>) => {
	const builder = new PrismaQueryBuilder<Prisma.SizeWhereInput>(query);
	const prismaArgs = builder
		.withDefaultFilter({ isDeleted: false })
		.search(["name"])
		.filter()
		.paginate()
		.sort()
		.build();
	const size = await prisma.size.findMany(prismaArgs);
	const meta = await builder.getMeta(prisma.size);
	return { meta, size };
};

const findById = async (id: string) => {
	const size = await prisma.size.findUniqueOrThrow({
		where: { id },
	});

	if (size.isDeleted) {
		throw new CustomError(400, "Size exist but status is deleted");
	}

	return size;
};

const updateData = async (id: string, payload: Size) => {
	await prisma.size.findUniqueOrThrow({ where: { id } }); // find size or throw error

	const updatedData = await prisma.size.update({
		where: { id },
		data: payload,
	});
	return updatedData;
};

const deleteData = async (id: string) => {
	await prisma.size.findUniqueOrThrow({
		where: { id },
	});
	const data = await prisma.size.update({
		where: { id },
		data: {
			isDeleted: true,
		},
	});

	return data;
};

export const sizeServices = {
	createIntoDB,
	findAllFromDB,
	findById,
	updateData,
	deleteData,
};
