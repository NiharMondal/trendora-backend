import { Prisma } from "@/lib/prisma-client";
import { prisma } from "@/config/db";
import PrismaQueryBuilder from "@/lib/PrismaQueryBuilder";
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

/**
 * One user's wishlist.
 *
 * Unlike the admin lists, this is already scoped to a single person, so it was
 * never going to return the whole table. It is paginated anyway to put a
 * ceiling on it — nothing stops someone wishlisting thousands of products.
 *
 * **The default limit is deliberately 100, not the usual 10.** The storefront
 * calls this with no pagination params, so a default of 10 would silently show
 * a shopper only the first ten items of their own wishlist. 100 supports paging
 * for a client that asks while not truncating anyone in practice; drop it to
 * the standard default once the frontend pages properly.
 */
const findByUserId = async (id: string, query: Record<string, unknown> = {}) => {
	const builder = new PrismaQueryBuilder<Prisma.WishlistWhereInput>(query, {
		model: "Wishlist",
		limit: 100,
	});

	const prismaArgs = builder
		.withDefaultFilter({ userId: id })
		.filter()
		.paginate()
		.sort()
		.include({
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
		})
		.build();

	const [myWishLists, meta] = await Promise.all([
		prisma.wishlist.findMany(prismaArgs),
		builder.getMeta(prisma.wishlist),
	]);

	return { meta, wishlists: myWishLists };
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
