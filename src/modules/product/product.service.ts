import { Prisma, Product } from "../../../generated/prisma";
import { prisma } from "../../config/db";
import { generateSlug } from "../../helpers/slug";
import PrismaQueryBuilder from "../../lib/PrismaQueryBuilder";
import CustomError from "../../utils/customError";

type ProductCreatePayload = Omit<
	Product,
	"id" | "slug" | "createdAt" | "updatedAt" | "images" | "variants"
> & {
	images: { id?: string; url: string; isMain: boolean }[];
	variants?: {
		id?: string;
		size: string;
		color: string;
		stock: number;
		price: number;
	}[];
};

const createIntoDB = async (payload: ProductCreatePayload) => {
	const { variants, images, discountPrice, ...others } = payload;
	const slug = generateSlug(payload.name);
	let dis_Price =
		discountPrice !== null &&
		discountPrice !== undefined &&
		Number(discountPrice) <= 1
			? null
			: discountPrice;
	const data = await prisma.product.create({
		data: {
			...others,
			slug,
			discountPrice: dis_Price,
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

	const prismaArgs = builder
		.withDefaultFilter({ isDeleted: false })
		.search(["name"])
		.filter()
		.paginate()
		.build();

	const product = await prisma.product.findMany(prismaArgs);
	const meta = await builder.getMeta(prisma.product);

	return { meta, product };
};

const findById = async (id: string) => {
	const product = await prisma.product.findUniqueOrThrow({
		where: { id },
		include: {
			variants: true,
			images: true,
		},
	});

	return product;
};
const findBySlug = async (slug: string) => {
	const product = await prisma.product.findUniqueOrThrow({
		where: { slug },
		include: {
			variants: true,
			images: true,
		},
	});

	return product;
};

const updateData = async (
	id: string,
	payload: Partial<ProductCreatePayload>
) => {
	const { variants = [], images = [], ...rest } = payload;

	// Check product existence
	const product = await prisma.product.findUnique({
		where: { id },
		include: { variants: true, images: true },
	});

	if (!product) {
		throw new CustomError(404, "Product not found!");
	}

	const slug = generateSlug(rest.name || product.name);

	// Collect existing IDs
	const existingVariantIds = product.variants.map((v) => v.id);
	const existingImageIds = product.images.map((i) => i.id);

	// Extract IDs from incoming payload
	const incomingVariantIds = variants
		.filter((v) => v.id)
		.map((v) => v.id as string);
	const incomingImageIds = images
		.filter((i) => i.id)
		.map((i) => i.id as string);

	// IDs to delete (those that exist in DB but not in request)
	const variantIdsToDelete = existingVariantIds.filter(
		(id) => !incomingVariantIds.includes(id)
	);
	const imageIdsToDelete = existingImageIds.filter(
		(id) => !incomingImageIds.includes(id)
	);

	// Begin transaction to ensure atomicity
	const updatedProduct = await prisma.$transaction(async (tx) => {
		// Delete removed variants/images
		if (variantIdsToDelete.length > 0) {
			await tx.productVariant.deleteMany({
				where: { id: { in: variantIdsToDelete } },
			});
		}
		if (imageIdsToDelete.length > 0) {
			await tx.productImage.deleteMany({
				where: { id: { in: imageIdsToDelete } },
			});
		}

		// Upsert (update existing or create new) variants
		for (const variant of variants) {
			if (variant.id) {
				await tx.productVariant.update({
					where: { id: variant.id },
					data: {
						size: variant.size,
						color: variant.color,
						stock: variant.stock,
						price: variant.price,
					},
				});
			} else {
				await tx.productVariant.create({
					data: {
						productId: id,
						size: variant.size,
						color: variant.color,
						stock: variant.stock,
						price: variant.price,
					},
				});
			}
		}

		// Upsert images
		for (const image of images) {
			if (image.id) {
				await tx.productImage.update({
					where: { id: image.id },
					data: {
						url: image.url,
						isMain: image.isMain,
					},
				});
			} else {
				await tx.productImage.create({
					data: {
						productId: id,
						url: image.url,
						isMain: image.isMain,
					},
				});
			}
		}

		// Finally update main product info
		const updated = await tx.product.update({
			where: { id },
			data: {
				...rest,
				slug,
			},
			include: {
				variants: true,
				images: true,
			},
		});

		return updated;
	});

	return updatedProduct;
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
