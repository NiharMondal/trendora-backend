import { prisma } from "@/config/db";
import CustomError from "@/utils/customError";
import { TCreateWishListType } from "./wishlist.validation";

/**
 * Resolve one wishlist row *belonging to the caller*, or fail.
 *
 * `authGuard` proves the caller is signed in; it cannot prove the row is
 * theirs. Without this, the id in the URL is all it takes to read or delete
 * items out of someone else's wishlist.
 *
 * **404, not 403** — a 403 confirms the row exists, which is enough to
 * enumerate. Same convention as `findOwnedAddress`
 * (`src/modules/address/address.service.ts`) and `assertVendorOwnsProduct`
 * (`src/helpers/vendor.ts`).
 */
const findOwnedWishlist = async (id: string, userId: string) => {
	const wishlist = await prisma.wishlist.findFirst({
		where: { id, userId },
	});

	if (!wishlist) {
		throw new CustomError(404, "Wishlist item not found");
	}

	return wishlist;
};

const createIntoDB = async (payload: TCreateWishListType, userId: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
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

	// Scoped to THIS user. Without the `userId` half this read matched any
	// row for the product, so the first person to wishlist something locked
	// every other shopper out of it.
	//
	// Reads through the `@@unique([userId, productId])` index, so it is a
	// single keyed lookup. That same constraint is the backstop if two
	// concurrent requests both get past this check — the loser surfaces as a
	// P2002, which `globalErrorHandler` already maps.
	const sameData = await prisma.wishlist.findUnique({
		where: {
			userId_productId: { userId, productId: payload.productId },
		},
	});

	if (sameData) {
		throw new CustomError(400, "Sorry, This product already exist");
	}

	const data = await prisma.wishlist.create({
		data: {
			userId,
			productId: payload.productId,
		},
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

const findById = async (id: string, userId: string) => {
	return findOwnedWishlist(id, userId);
};

/**
 * Hard delete, unlike the address case: `Wishlist` has no `isDeleted` column
 * and nothing references the row, so there is no history to preserve.
 */
const deleteData = async (id: string, userId: string) => {
	await findOwnedWishlist(id, userId);

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
