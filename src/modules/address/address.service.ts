import { Address, Category, Prisma } from "../../../generated/prisma";
import { prisma } from "../../config/db";
import { generateSlug } from "../../helpers/slug";
import PrismaQueryBuilder from "../../lib/PrismaQueryBuilder";

const createIntoDB = async (payload: Address) => {
	const address = await prisma.address.create({
		data: payload,
	});

	return address;
};

const findAddressByUserId = async (query: Record<string, any>) => {
	const builder = new PrismaQueryBuilder<Prisma.CategoryWhereInput>(query);

	const prismaArgs = builder.search(["name"]).filter().paginate().build();

	const category = await prisma.category.findMany(prismaArgs);
	const meta = await builder.getMeta(prisma.category);

	return { meta, category };
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

export const addressServices = {
	createIntoDB,
	findAddressByUserId,
	findById,
	updateData,
	deleteData,
};
