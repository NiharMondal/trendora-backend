import { prisma } from "../../config/db";

const getAllFromDB = async () => {
	const users = prisma.user.findMany();

	return users;
};

export const userServices = { getAllFromDB };
