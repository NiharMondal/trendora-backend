import { Wishlist } from "../../../generated/prisma";
import { prisma } from "../../config/db";
import CustomError from "../../utils/customError";
import { TCreateWishListType } from "./wishlist.validation";

const createIntoDB = async (payload: TCreateWishListType) => {
	const user = await prisma.user.findUnique({
		where: { id: payload.userId },
	});

	if (!user) {
		throw new CustomError(404, "Sorry, User not found!");
	}
	const product = await prisma.product.findUnique({
		where: { id: payload.productId, isDeleted: false },
	});

	if (!product) {
		throw new CustomError(404, "Sorry, Product not found!");
	}

	const sameData = await prisma.wishlist.findFirst({
		where: { productId: payload.productId },
	});

	if (sameData) {
		throw new CustomError(400, "Sorry, This product already exist");
	}
	const data = await prisma.wishlist.create({
		data: payload,
	});

	return data;
};

const findByUserId = async (id: string) => {
	const myWishLists = await prisma.wishlist.findMany({
		where: {
			userId: id,
		},
		include: {
			product: {
				select: {
					name: true,
					id: true,
					slug: true,
					basePrice: true,
					discountPrice: true,
					images: true,
				},
			},
		},
	});

	return myWishLists;
};

const findById = async (id: string) => {
	const wishlist = await prisma.wishlist.findUniqueOrThrow({
		where: { id },
	});

	return wishlist;
};

const deleteData = async (id: string) => {
	const wishlist = await prisma.wishlist.delete({
		where: { id },
	});

	return wishlist;
};

export const wishlistServices = {
	createIntoDB,

	findByUserId,
	findById,

	deleteData,
};
