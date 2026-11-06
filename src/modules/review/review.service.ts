import { Prisma, Review, Role } from "@/lib/prisma-client";
import { prisma } from "@/config/db";
import { publicProductFilter } from "@/helpers/vendor";
import PrismaQueryBuilder from "@/lib/PrismaQueryBuilder";
import CustomError from "@/utils/customError";

type TActor = { id: string; role: string };

/**
 * Recompute a product's denormalised rating counters. Called inside the same
 * transaction as every review write so `averageRating` / `totalReviews` on the
 * product card can never drift from the reviews themselves.
 */
const recomputeProductRating = async (
	tx: Prisma.TransactionClient,
	productId: string,
) => {
	const stats = await tx.review.aggregate({
		where: { productId, isDeleted: false },
		_avg: { rating: true },
		_count: { rating: true },
	});

	await tx.product.update({
		where: { id: productId },
		data: {
			averageRating: stats._avg.rating ?? null,
			totalReviews: stats._count.rating,
		},
	});
};

const createIntoDB = async (payload: Review) => {
	const user = await prisma.user.findUnique({
		where: { id: payload.userId },
	});

	if (!user) {
		throw new CustomError(404, "Sorry, User not found!");
	}
	const product = await prisma.product.findFirst({
		where: publicProductFilter({ id: payload.productId }),
	});

	if (!product) {
		throw new CustomError(404, "Sorry, Product not found!");
	}

	const result = await prisma.$transaction(async (tx) => {
		const review = await tx.review.create({
			data: payload,
		});

		await recomputeProductRating(tx, payload.productId);

		return review;
	});

	return result;
};

const findAllFromDB = async (query: Record<string, unknown>) => {
	const builder = new PrismaQueryBuilder<Prisma.ReviewWhereInput>(query, { model: "Review" });

	const prismaArgs = builder
		.search(["comment"])
		.filter()
		.paginate()
		.sort("createdAt", "desc")
		.include({
			user: {
				select: {
					name: true,
					avatar: true,
				},
			},
		})
		.build();

	const [reviews, meta] = await Promise.all([
		prisma.review.findMany(prismaArgs),
		builder.getMeta(prisma.review),
	]);

	return { reviews, meta };
};

const findAllReviewsByProductId = async (productId: string) => {
	const reviews = await prisma.review.findMany({
		where: { productId, isDeleted: false },
		include: {
			user: {
				select: {
					name: true,
					avatar: true,
				},
			},
		},
		orderBy: {
			createdAt: "desc",
		},
		take: 10,
		skip: 0,
	});

	return reviews;
};

const findById = async (id: string) => {
	const review = await prisma.review.findUniqueOrThrow({
		where: { id },
		include: {
			user: {
				select: {
					name: true,
				},
			},
		},
	});

	return review;
};
const findByUserId = async (id: string) => {
	const review = await prisma.review.findMany({
		where: { userId: id, isDeleted:false },
		include: {
			product: {
				select: {
					name: true,
					slug: true,
					id: true,
					images: true,
				},
			},
		},
	});

	return review;
};

const updateData = async (
	actor: TActor,
	id: string,
	payload: Partial<Review>,
) => {
	return await prisma.$transaction(async (tx) => {
		// Fetch existing review
		const existingReview = await tx.review.findUnique({
			where: { id, isDeleted: false },
		});

		if (!existingReview) {
			throw new CustomError(404, "Review not found");
		}

		// Only the author may edit their review (an admin may moderate any).
		if (
			actor.role !== Role.ADMIN &&
			existingReview.userId !== actor.id
		) {
			throw new CustomError(403, "You can only edit your own review");
		}

		const updatedReview = await tx.review.update({
			where: { id },
			// Never let the body reassign authorship or move the review to
			// another product.
			data: {
				rating: payload.rating,
				comment: payload.comment,
			},
		});

		await recomputeProductRating(tx, existingReview.productId);

		return updatedReview;
	});
};

const deleteData = async (actor: TActor, id: string) => {
	return await prisma.$transaction(async (tx) => {
		//  Fetch review
		const review = await tx.review.findUnique({
			where: { id, isDeleted: false },
		});

		if (!review) {
			throw new CustomError(404, "Review not found");
		}

		if (actor.role !== Role.ADMIN && review.userId !== actor.id) {
			throw new CustomError(403, "You can only delete your own review");
		}

		// Soft delete — this used to be a hard `delete` despite the comment,
		// which lost the audit trail and broke the isDeleted filters.
		const deletedReview = await tx.review.update({
			where: { id },
			data: { isDeleted: true },
		});

		await recomputeProductRating(tx, review.productId);

		return deletedReview;
	});
};

export const reviewServices = {
	createIntoDB,
	findAllFromDB,
	findByUserId,
	findById,
	updateData,
	deleteData,

	findAllReviewsByProductId,
};
