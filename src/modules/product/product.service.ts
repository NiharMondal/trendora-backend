import { Prisma, Product } from "../../../generated/prisma";
import { prisma } from "../../config/db";
import { generateSlug } from "../../helpers/slug";
import PrismaQueryBuilder from "../../lib/PrismaQueryBuilder";

type ProductCreatePayload = Omit<
	Product,
	"id" | "slug" | "createdAt" | "updatedAt" | "images" | "variants"
> & {
	images?: { url: string; isMain: boolean }[];
	variants?: { size: string; color: string; stock: number; price: number }[];
};

const createIntoDB = async (payload: ProductCreatePayload) => {
	const { variants, images, ...others } = payload;
	const slug = generateSlug(payload.name);

	const data = await prisma.product.create({
		data: {
			...others,
			slug,
			variants: {
				create: variants?.map((v) => ({
					size: v.size,
					color: v.color,
					stock: v.stock,
					price: v.price,
				})),
			},
			images: {
				create: images?.map((img) => ({
					url: img.url,
					isMain: img.isMain,
				})),
			},
		},
		include: {
			images: true,
			variants: true,
		},
	});

	return data;
};

const findAllFromDB = async (query: Record<string, any>) => {
	const builder = new PrismaQueryBuilder<Prisma.ProductWhereInput>(query);

	const prismaArgs = builder.search(["name"]).filter().paginate().build();

	const product = await prisma.product.findMany(prismaArgs);
	const meta = await builder.getMeta(prisma.product);

	return { meta, product };
};

const findById = async (id: string) => {
	const product = await prisma.product.findUniqueOrThrow({
		where: { id },
	});

	return product;
};
const findBySlug = async (slug: string) => {
	const product = await prisma.product.findUniqueOrThrow({
		where: { slug },
	});

	return product;
};

const updateData = async (id: string, payload: Partial<Product>) => {
	await prisma.product.findUniqueOrThrow({
		where: { id },
	});

	const slug = generateSlug(payload.name as string);

	const updatedData = await prisma.product.update({
		where: { id },
		data: { ...payload, slug },
	});
	return updatedData;
};

const deleteData = async (id: string) => {
	await prisma.product.findUniqueOrThrow({
		where: { id },
	});
	const data = await prisma.product.update({
		where: { id },
		data: {
			isDeleted: true,
		},
	});

	return data;
};

export const productServices = {
	createIntoDB,
	findAllFromDB,
	findById,
	findBySlug,
	updateData,
	deleteData,
};
