import { Prisma, SizeGroup } from "../../../generated/prisma";
import { prisma } from "../../config/db";
import PrismaQueryBuilder from "../../lib/PrismaQueryBuilder";
import CustomError from "../../utils/customError";

const createIntoDB = async (payload: SizeGroup) => {
	const data = await prisma.sizeGroup.create({
		data: payload,
	});

	return data;
};

const findAllFromDB = async (query: Record<string, unknown>) => {
	const builder = new PrismaQueryBuilder<Prisma.SizeGroupWhereInput>(query);

	const prismaArgs = builder
		.withDefaultFilter({ isDeleted: false })
		.search(["name"])
		.filter()
		.paginate()
		.sort()
		.build();

	const [sizeGroups, meta] = await Promise.all([
		prisma.sizeGroup.findMany(prismaArgs),
		builder.getMeta(prisma.sizeGroup),
	]);

	return { meta, sizeGroups };
};

const findById = async (id: string) => {
	const sizeGroup = await prisma.sizeGroup.findUniqueOrThrow({
		where: { id },
	});

	if (sizeGroup.isDeleted) {
		throw new CustomError(400, "SizeGroup exist but status is deleted");
	}

	return sizeGroup;
};

const updateData = async (id: string, payload: SizeGroup) => {
	await prisma.sizeGroup.findUniqueOrThrow({ where: { id } }); // find sizeGroup or throw error

	const updatedData = await prisma.sizeGroup.update({
		where: { id },
		data: payload,
	});
	return updatedData;
};

const deleteData = async (id: string) => {
	await prisma.sizeGroup.findUniqueOrThrow({
		where: { id },
	});
	const data = await prisma.sizeGroup.update({
		where: { id },
		data: {
			isDeleted: true,
		},
	});

	return data;
};

export const sizeGroupServices = {
	createIntoDB,
	findAllFromDB,
	findById,
	updateData,
	deleteData,
};
