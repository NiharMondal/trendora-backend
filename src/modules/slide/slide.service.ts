import { Prisma } from "@/lib/prisma-client";
import { prisma } from "@/config/db";
import PrismaQueryBuilder from "@/lib/PrismaQueryBuilder";
import CustomError from "@/utils/customError";
import { deleteFromCloudinary, moveFromTemp } from "@/utils/cloudinary";

import { TSlide, TSlideUpdate } from "./slide.validation";

type TPhotoPayload = TSlide["photo"] | undefined;

/**
 * Turn the client's `{ url, publicId }` into the two columns that store it,
 * promoting a Cloudinary upload out of `temp/` on the way — the same shape as
 * `resolveImageColumns` in the category service.
 *
 * A slide is live on the storefront hero, and a publicId still containing
 * `/temp/` is deletable by anyone through the unauthenticated
 * `/cloudinary/delete-temp` (BE-41), so a save must never persist one.
 *
 *   `undefined`    -> not in the request; change nothing.
 *   empty publicId -> an image hosted elsewhere; store the URL, no publicId.
 *   an object      -> set it, and destroy the Cloudinary asset it replaced.
 */
const resolvePhotoColumns = async (
	photo: TPhotoPayload,
	previousPublicId?: string | null,
): Promise<{ photoUrl?: string; photoPublicId?: string | null }> => {
	if (photo === undefined) return {};

	const stored = !photo.publicId
		? { url: photo.url, publicId: null }
		: photo.publicId.includes("/temp/")
			? await moveFromTemp(photo.publicId)
			: { url: photo.url, publicId: photo.publicId };

	// Unchanged photo on an unrelated edit — nothing to clean up.
	if (previousPublicId && previousPublicId !== stored.publicId) {
		await deleteFromCloudinary(previousPublicId);
	}

	return { photoUrl: stored.url, photoPublicId: stored.publicId };
};

const createIntoDB = async (payload: TSlide) => {
	// `photo` is a nested object mapping onto two scalar columns, so it must
	// not reach Prisma inside the spread.
	const { photo, ...rest } = payload;

	const data = await prisma.slide.create({
		data: {
			...rest,
			photoUrl: photo.url,
			...(await resolvePhotoColumns(photo)),
		},
	});

	return data;
};

/**
 * Hero slides.
 *
 * Was a hardcoded `take: 4` that ignored the caller's `limit` entirely — the
 * storefront slider asks for 5 and silently got 4. Now paginated like every
 * other list, so the request is honoured.
 *
 * `isActive` and `sortOrder` are applied since BE-16: the public list hard-filters
 * `isActive`, and both lists sort by `sortOrder`.
 */
/**
 * Runs a slide list query.
 *
 * `Slide` has no relations, so Prisma's `findMany` args have no `include` key
 * at all — the builder's is destructured away.
 */
const listSlides = async (
	query: Record<string, unknown>,
	defaultFilter: Prisma.SlideWhereInput,
) => {
	const builder = new PrismaQueryBuilder<Prisma.SlideWhereInput>(query, {
		model: "Slide",
	});

	const { include: _include, ...prismaArgs } = builder
		.withDefaultFilter(defaultFilter)
		.search(["title", "subtitle"])
		.filter()
		.paginate()
		// `sortOrder` is the whole point of the column: it is the operator's
		// chosen display order, so it is the default sort rather than
		// `createdAt`. A caller can still override with `?sortBy=`.
		.sort("sortOrder", "asc")
		.build();

	const [slides, meta] = await Promise.all([
		prisma.slide.findMany(prismaArgs),
		builder.getMeta(prisma.slide),
	]);

	return { meta, slides };
};

/**
 * The storefront's slides. **Public**, so `isActive` is a hard filter rather
 * than a default a caller could override — otherwise `?isActive=false` would
 * hand anyone the banners an operator had deliberately taken down.
 *
 * Admins list the full set, including deactivated ones, via
 * `findAllForAdmin` — the same split as `GET /products` vs
 * `/products/admin/all`.
 */
const findAllFromDB = async (query: Record<string, unknown>) =>
	listSlides(query, { isDeleted: false, isActive: true });

/**
 * ADMIN listing: every slide that has not been deleted, active or not.
 *
 * Without this, deactivating a slide would make it unreachable — the public
 * list hides it and there would be no other way to find it again.
 */
const findAllForAdmin = async (query: Record<string, unknown>) =>
	listSlides(query, { isDeleted: false });

const findById = async (id: string) => {
	const slide = await prisma.slide.findUniqueOrThrow({
		where: { id },
	});

	if (slide.isDeleted) {
		throw new CustomError(400, "Slide exist but status is deleted");
	}

	return slide;
};

const updateData = async (id: string, payload: TSlideUpdate) => {
	const slide = await prisma.slide.findUniqueOrThrow({ where: { id } });

	const { photo, ...rest } = payload;

	const updatedData = await prisma.slide.update({
		where: { id },
		data: {
			...rest,
			...(await resolvePhotoColumns(photo, slide.photoPublicId)),
		},
	});
	return updatedData;
};

const deleteData = async (id: string) => {
	await prisma.slide.findUniqueOrThrow({
		where: { id },
	});
	const data = await prisma.slide.update({
		where: { id },
		data: {
			isDeleted: true,
		},
	});

	return data;
};

export const slideServices = {
	createIntoDB,
	findAllFromDB,
	findAllForAdmin,
	findById,
	updateData,
	deleteData,
};
