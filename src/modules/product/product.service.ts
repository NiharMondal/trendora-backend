import { Prisma, Product } from "../../../generated/prisma";
import { prisma } from "../../config/db";
import { generateSlug } from "../../helpers/slug";
import PrismaQueryBuilder from "../../lib/PrismaQueryBuilder";
import { deleteFromCloudinary, moveFromTemp } from "../../utils/cloudinary";
import CustomError from "../../utils/customError";

type ProductCreatePayload = Omit<
	Product,
	"id" | "slug" | "createdAt" | "updatedAt" | "images" | "variants"
> & {
	images: { id?: string; url: string; isMain: boolean, publicId: string, altText?: string }[];
	variants?: {
		id?: string;
		sizeId: string;
		color: string;
		stock: number;
		price: number;
	}[];
};

const createIntoDB = async (payload: ProductCreatePayload) => {
	const { variants, images, discountPrice, ...others } = payload;
	// find category
	const category = await prisma.category.findUnique({
		where: { id: payload.categoryId },
	});

	if (!category) {
		throw new CustomError(404, "Category not found");
	}
	// find brand
	const brand = await prisma.brand.findUnique({
		where: { id: payload.brandId },
	});
	if (!brand) {
		throw new CustomError(404, "Brand not found");
	}

	const movedImages = await Promise.all(images.map(async (img) => {
		if (img.publicId.includes("/temp/")) {
			const { publicId, url } = await moveFromTemp(img.publicId);
			return { ...img, publicId, url }
		}
		return img;
	}));

	const slug = generateSlug(payload.name);
	const dis_Price =
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
					sizeId: v.sizeId,
					color: v.color,
					stock: v.stock,
					price: v.price,
				})),
			},
			images: {
				create: movedImages?.map((img) => ({
					url: img.url,
					publicId: img.publicId,
					altText: img.altText,
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

const findAllFromDB = async (query: Record<string, unknown>) => {
	const builder = new PrismaQueryBuilder<Prisma.ProductWhereInput>(query);

	const prismaArgs = builder
		.withDefaultFilter({ isDeleted: false })
		.search(["name", "description"])
		.filter()
		.paginate()
		.sort()
		.include({
			images: {
				select: { id: true, url: true, isMain: true },
			},
			variants: true,
			category: true,
			brand: true,
		})
		.build();

	const [products, meta] = await Promise.all([
		prisma.product.findMany(prismaArgs),
		builder.getMeta(prisma.product),
	]);

	return { meta, data: products };
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
			variants: {
				include: {
					size: {
						select: {
							id: true,
							name: true,
						}
					}
				}
			},
			images: true,
			brand: true
		},
	});

	return product;
};

const updateData = async (
	id: string,
	payload: Partial<ProductCreatePayload>,
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
		(id) => !incomingVariantIds.includes(id),
	);
	const imageIdsToDelete = existingImageIds.filter(
		(id) => !incomingImageIds.includes(id),
	);

	// 1. Delete removed images from cloudinary
	const imagesToDelete = product.images.filter(img => imageIdsToDelete.includes(img.id))

	await Promise.all(imagesToDelete.map(img => deleteFromCloudinary(img.publicId)));

	// 2. Move new temp images to final folder
	const processedImages = await Promise.all(
		images.map(async (img) => {
			// New image (no id) and still in temp → move to final
			if (!img.id && img.publicId?.includes("/temp/")) {
				const { publicId, url } = await moveFromTemp(img.publicId);
				return { ...img, publicId, url };
			}
			return img; // existing image, no change needed
		}),
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
						sizeId: variant.sizeId,
						color: variant.color,
						stock: variant.stock,
						price: variant.price,
					},
				});
			} else {
				await tx.productVariant.create({
					data: {
						productId: id,
						sizeId: variant.sizeId,
						color: variant.color,
						stock: variant.stock,
						price: variant.price,
					},
				});
			}
		}

		// Upsert images
		for (const image of processedImages) {
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
						publicId: image.publicId,
						altText: image.altText,
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

const newArrivalProducts = async () => {
	const products = await prisma.product.findMany({
		where: { isDeleted: false },
		orderBy: { createdAt: "desc" },
		take: 10,
		include: {
			images: true,
			variants: true,
		},
	});

	return products;
};


const relatedProducts = async (id: string) => {

	const product = await prisma.product.findUniqueOrThrow({
		where: { id },
		include: {
			category: true,
			brand: true,
		},
	});

	const referencePrice = Number(product.discountPrice ?? product.basePrice);

	const minPrice = referencePrice * 0.8;
	const maxPrice = referencePrice * 1.2;

	const products = await prisma.product.findMany({
		where: {
			id: { not: id },
			isDeleted: false,
			AND: [
				{
					OR: [{ discountPrice: { not: null, gte: minPrice, lte: maxPrice } }, { discountPrice: null, basePrice: { gte: minPrice, lte: maxPrice } }],
				},
			],
		},
		take: 10,
		include: {
			images: {
				select: { id: true, url: true, isMain: true },
			},
		},
	});
	return products;
};

export const productServices = {
	createIntoDB,
	findAllFromDB,
	findById,
	findBySlug,
	updateData,
	deleteData,
	//
	newArrivalProducts,
	relatedProducts,
};
