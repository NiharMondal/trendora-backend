import { Category, Prisma } from "../../../generated/prisma";
import { prisma } from "../../config/db";
import { generateSlug } from "../../helpers/slug";
import PrismaQueryBuilder from "../../lib/PrismaQueryBuilder";

const createIntoDB = async (payload: Category) => {
	const slug = generateSlug(payload.name);

	const data = await prisma.category.create({
		data: { ...payload, slug },
	});

	return data;
};

const findAllFromDB = async (query: Record<string, any>) => {
	const builder = new PrismaQueryBuilder<Prisma.CategoryWhereInput>(query);

	const prismaArgs = builder.search(["name"]).filter().paginate().build();

	const category = await prisma.category.findMany(prismaArgs);
	const meta = await builder.getMeta(prisma.category);

	return { meta, category };
};

export const categoryServices = { createIntoDB, findAllFromDB };
