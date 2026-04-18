import { prisma } from "../../config/db";
import CustomError from "../../utils/customError";
import { TUserUpdateSchema } from "./user.validation";

const getAllFromDB = async () => {
	const users = prisma.user.findMany();

	return users;
};

const myProfile = async(userId: string)=> {
	const user = await prisma.user.findUnique({ where: { id: userId } });
	if (!user) {
		throw new CustomError(404, "User not found")
	}

	if (user && user?.isDeleted) {
		throw new CustomError(404, "User has been deleted")
	}
	return user;

}

const updateData = async (payload: TUserUpdateSchema, userId: string) => {
	const transformData = {
		name: payload?.name,
		phone: payload?.phone,
		avatar: payload?.avatar?.url,
		avatarPublicId: payload?.avatar?.publicId
	};
	const user = await prisma.user.findUnique({ where: { id: userId } });
	if (!user) {
		throw new CustomError(404, "User not found")
	}

	if (user && user?.isDeleted) {
		throw new CustomError(404, "User has been deleted")
	}

	const data = await prisma.user.update({
		where: { id: userId },
		data: transformData
	});

	return data;
}
export const userServices = { getAllFromDB, myProfile, updateData };
