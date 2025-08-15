import { Address, Category, Prisma } from "../../../generated/prisma";
import { prisma } from "../../config/db";
import { generateSlug } from "../../helpers/slug";
import PrismaQueryBuilder from "../../lib/PrismaQueryBuilder";
import CustomError from "../../utils/customError";

const createIntoDB = async (payload: Address) => {
	const address = await prisma.address.create({
		data: payload,
	});

	return address;
};

const findAddressByUserId = async (userId: string) => {
	const user = await prisma.user.findUnique({ where: { id: userId } });

	if (!user) {
		throw new CustomError(404, "Sorry, user not found!");
	}
	const addresses = await prisma.address.findMany({
		where: {
			userId: userId,
		},
	});

	return addresses;
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
