import { Address } from "../../../generated/prisma";
import { prisma } from "../../config/db";
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
	const address = await prisma.address.findUniqueOrThrow({
		where: { id },
	});

	return address;
};

const updateData = async (id: string, payload: Partial<Address>) => {
	await prisma.address.findUniqueOrThrow({
		where: { id },
	});

	const updatedData = await prisma.address.update({
		where: { id },
		data: payload,
	});

	return updatedData;
};

const deleteData = async (id: string) => {
	await prisma.address.findUniqueOrThrow({
		where: { id },
	});
	const data = await prisma.address.delete({
		where: { id },
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
