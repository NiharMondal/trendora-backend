import { prisma } from "../../config/db";
import { deleteFromCloudinary, moveFromTemp } from "../../utils/cloudinary";
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

	const user = await prisma.user.findUnique({ where: { id: userId } });
	if (!user) {
		throw new CustomError(404, "User not found")
	}

	if (user && user?.isDeleted) {
		throw new CustomError(404, "User has been deleted")
	}

	const transformData = {
		name: payload?.name,
		phone: payload?.phone,
		avatar: payload.avatar?.url,
		avatarPublicId: payload.avatar?.publicId
	};

	if(payload?.avatar?.publicId){
		const tempPublicId = payload?.avatar?.publicId;
		if(tempPublicId.includes("/temp")){
			// 1. Delete old avatar from Cloudinary if exists
			if(user.avatarPublicId){
				await deleteFromCloudinary(user.avatarPublicId);
			}

			// 2. Move new image from temp -> final folder
			const {publicId, url}  = await moveFromTemp(tempPublicId);
			transformData.avatar = url;
			transformData.avatarPublicId = publicId;
		}
	}
	const data = await prisma.user.update({
		where: { id: userId },
		data: transformData
	});

	return data;
}
export const userServices = { getAllFromDB, myProfile, updateData };
