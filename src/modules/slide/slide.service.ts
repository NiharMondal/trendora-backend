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
const findAllFromDB = async (query: Record<string, unknown>) => {
	const builder = new PrismaQueryBuilder<Prisma.SlideWhereInput>(query, {
		model: "Slide",
	});

	// `Slide` has no relations, so Prisma's findMany args have no `include`
	// key at all — drop the builder's before handing them over.
	const { include: _include, ...prismaArgs } = builder
		.withDefaultFilter({ isDeleted: false })
		.filter()
		.paginate()
		.sort()
		.build();

	const [slides, meta] = await Promise.all([
		prisma.slide.findMany(prismaArgs),
		builder.getMeta(prisma.slide),
	]);

	return { meta, slides };
};

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
	findById,
	updateData,
	deleteData,
};
