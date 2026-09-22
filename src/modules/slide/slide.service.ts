import { Prisma, Slide } from "@/lib/prisma-client";
import { prisma } from "@/config/db";
import PrismaQueryBuilder from "@/lib/PrismaQueryBuilder";
import CustomError from "@/utils/customError";

const createIntoDB = async (payload: Slide) => {
	const data = await prisma.slide.create({
		data: payload,
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
 * `isActive` and `sortOrder` are still not applied — that is BE-16.
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

const updateData = async (id: string, payload: Slide) => {
	await prisma.slide.findUniqueOrThrow({ where: { id } }); // find slide or throw error

	const updatedData = await prisma.slide.update({
		where: { id },
		data: payload,
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
