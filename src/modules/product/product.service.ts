import { Prisma, ProductStatus, Role } from "../../../generated/prisma";
import { prisma } from "../../config/db";
import { generateUniqueProductSlug } from "../../helpers/slug";
import {
	assertVendorOwnsProduct,
	publicProductFilter,
	publicVendorSelect,
	resolveVendorScope,
	vendorListScope,
} from "../../helpers/vendor";
import PrismaQueryBuilder from "../../lib/PrismaQueryBuilder";
import { deleteFromCloudinary, moveFromTemp } from "../../utils/cloudinary";
import CustomError from "../../utils/customError";
import {
	TProductCreate,
	TProductUpdate,
	TRejectProduct,
} from "./product.validation";

type TActor = { id: string; role: string };

/** Store identity attached to every product read, so cards can link to it. */
const vendorCardSelect = {
	id: true,
	storeName: true,
	slug: true,
	logo: true,
	averageRating: true,
	status: true,
	// The cart groups by store and charges shipping per store, so a product
	// payload has to carry its store's delivery terms.
	shippingFee: true,
	freeShippingThreshold: true,
} satisfies Prisma.VendorSelect;

/**
 * Editing one of these re-opens moderation: an approved listing whose name,
 * copy, imagery or taxonomy changed is effectively a new listing and must be
 * re-reviewed. Price and stock are deliberately absent — vendors need to
 * reprice and restock without waiting on an admin.
 */
const MATERIAL_FIELDS = [
	"name",
	"description",
	"categoryId",
	"brandId",
	"gender",
	"images",
] as const satisfies readonly (keyof TProductUpdate)[];

const promoteImages = async (
	images: { id?: string; url: string; publicId: string; altText?: string; isMain?: boolean }[],
) =>
	Promise.all(
		images.map(async (img) => {
			// Only assets still staged in temp/ are promoted — this guard is
			// what stops an existing live image from being renamed away.
			if (!img.id && img.publicId?.includes("/temp/")) {
				const { publicId, url } = await moveFromTemp(img.publicId);
				return { ...img, publicId, url };
			}
			return img;
		}),
	);

const createIntoDB = async (actor: TActor, payload: TProductCreate) => {
	const {
		variants,
		images,
		discountPrice,
		submitForReview,
		vendorId: requestedVendorId,
		...others
	} = payload;

	// Who does this listing belong to? A vendor can only ever create for
	// themselves; an admin must name the store explicitly.
	const vendorId = await resolveVendorScope(actor, requestedVendorId);

	const vendor = await prisma.vendor.findUniqueOrThrow({
		where: { id: vendorId },
		select: { slug: true },
	});

	const category = await prisma.category.findUnique({
		where: { id: payload.categoryId },
	});

	if (!category) {
		throw new CustomError(404, "Category not found");
	}

	const brand = await prisma.brand.findUnique({
		where: { id: payload.brandId },
	});
	if (!brand) {
		throw new CustomError(404, "Brand not found");
	}

	// Product names are unique per store, so give a clear error instead of a
	// raw P2002 from the composite constraint.
	const duplicate = await prisma.product.findFirst({
		where: { vendorId, name: payload.name },
		select: { id: true },
	});

	if (duplicate) {
		throw new CustomError(
			409,
			"You already have a product with this name in your store",
		);
	}

	const movedImages = await promoteImages(images);
	const slug = await generateUniqueProductSlug(payload.name, vendor.slug);

	const dis_Price =
		discountPrice !== null &&
			discountPrice !== undefined &&
			Number(discountPrice) <= 1
			? null
			: discountPrice;

	const status = submitForReview
		? ProductStatus.PENDING
		: ProductStatus.DRAFT;

	const data = await prisma.product.create({
		data: {
			...others,
			vendorId,
			slug,
			discountPrice: dis_Price,
			status,
			submittedAt: submitForReview ? new Date() : null,
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
			vendor: { select: vendorCardSelect },
		},
	});

	return data;
};

/**
 * The storefront listing. Only approved, published products from approved
 * stores — see publicProductFilter for the three gates.
 */
const findAllFromDB = async (query: Record<string, unknown>) => {
	const builder = new PrismaQueryBuilder<Prisma.ProductWhereInput>(query);

	const prismaArgs = builder
		.withDefaultFilter(publicProductFilter())
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
			vendor: { select: vendorCardSelect },
		})
		.build();

	const [products, meta] = await Promise.all([
		prisma.product.findMany(prismaArgs),
		builder.getMeta(prisma.product),
	]);

	return { meta, data: products };
};

/**
 * The caller's own catalogue, in every moderation state — this is the vendor
 * dashboard's product table. An ADMIN may narrow it with `?vendorId=`.
 */
const findMyProducts = async (
	actor: TActor,
	query: Record<string, unknown>,
) => {
	const scope = await vendorListScope(
		actor,
		query.vendorId ? String(query.vendorId) : undefined,
	);

	// vendorId is consumed by the scope; leaving it in would double-filter.
	const { vendorId: _ignored, ...rest } = query;

	const builder = new PrismaQueryBuilder<Prisma.ProductWhereInput>(rest);

	const prismaArgs = builder
		.withDefaultFilter({ isDeleted: false, ...scope })
		.search(["name", "description"])
		.filter()
		.paginate()
		.sort("createdAt", "desc")
		.include({
			images: { select: { id: true, url: true, isMain: true } },
			variants: true,
			category: { select: { id: true, name: true, slug: true } },
			brand: { select: { id: true, name: true } },
			_count: { select: { orderItems: true } },
		})
		.build();

	const [products, meta] = await Promise.all([
		prisma.product.findMany(prismaArgs),
		builder.getMeta(prisma.product),
	]);

	return { meta, data: products };
};

/** Every product in any state, for the admin moderation queue. */
const findAllForAdmin = async (query: Record<string, unknown>) => {
	const builder = new PrismaQueryBuilder<Prisma.ProductWhereInput>(query);

	const prismaArgs = builder
		.withDefaultFilter({ isDeleted: false })
		.search(["name", "description"])
		.filter()
		.paginate()
		.sort("createdAt", "desc")
		.include({
			images: { select: { id: true, url: true, isMain: true } },
			vendor: { select: vendorCardSelect },
			category: { select: { id: true, name: true } },
			brand: { select: { id: true, name: true } },
		})
		.build();

	const [products, meta] = await Promise.all([
		prisma.product.findMany(prismaArgs),
		builder.getMeta(prisma.product),
	]);

	return { meta, data: products };
};

/**
 * Public single-product read. Applies the visibility gates, so an unapproved
 * or hidden listing 404s for shoppers even if they know the id.
 */
const findById = async (id: string) => {
	const product = await prisma.product.findFirst({
		where: publicProductFilter({ id }),
		include: {
			variants: true,
			images: true,
			vendor: { select: publicVendorSelect },
		},
	});

	if (!product) {
		throw new CustomError(404, "Product not found");
	}

	return product;
};

/** Owner/admin single-product read, in any moderation state. */
const findMyProductById = async (actor: TActor, id: string) => {
	if (actor.role === Role.ADMIN) {
		const product = await prisma.product.findFirst({
			where: { id, isDeleted: false },
			include: {
				variants: { include: { size: true } },
				images: true,
				vendor: { select: vendorCardSelect },
			},
		});

		if (!product) throw new CustomError(404, "Product not found");
		return product;
	}

	const vendorId = await resolveVendorScope(actor);
	await assertVendorOwnsProduct(vendorId, id);

	return prisma.product.findUniqueOrThrow({
		where: { id },
		include: {
			variants: { include: { size: true } },
			images: true,
			vendor: { select: vendorCardSelect },
		},
	});
};

const findBySlug = async (slug: string) => {
	const product = await prisma.product.findFirst({
		where: publicProductFilter({ slug }),
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
			brand: true,
			vendor: { select: publicVendorSelect },
		},
	});

	if (!product) {
		throw new CustomError(404, "Product not found");
	}

	return product;
};

const updateData = async (
	actor: TActor,
	id: string,
	payload: TProductUpdate,
) => {
	// `submitForReview` is a create-time flag; moderation state is changed
	// through /submit and /approve, never as a side effect of an edit.
	const {
		variants = [],
		images = [],
		submitForReview: _ignoredSubmitFlag,
		...rest
	} = payload;

	// Ownership first: a vendor may only touch their own listing, and the
	// 404 (not 403) keeps another store's product ids unguessable.
	const isAdmin = actor.role === Role.ADMIN;

	const product = isAdmin
		? await prisma.product.findFirst({
			where: { id, isDeleted: false },
			include: { variants: true, images: true, vendor: true },
		})
		: await (async () => {
			const vendorId = await resolveVendorScope(actor);
			await assertVendorOwnsProduct(vendorId, id);
			return prisma.product.findUnique({
				where: { id },
				include: { variants: true, images: true, vendor: true },
			});
		})();

	if (!product) {
		throw new CustomError(404, "Product not found!");
	}

	if (rest.name && rest.name !== product.name) {
		const duplicate = await prisma.product.findFirst({
			where: {
				vendorId: product.vendorId,
				name: rest.name,
				id: { not: id },
			},
			select: { id: true },
		});

		if (duplicate) {
			throw new CustomError(
				409,
				"You already have a product with this name in your store",
			);
		}
	}

	const slug = rest.name
		? await generateUniqueProductSlug(rest.name, product.vendor.slug, id)
		: product.slug;

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

	// IDs to delete (those that exist in DB but not in request). An empty
	// images/variants array means "unchanged", not "delete everything".
	const variantIdsToDelete = variants.length
		? existingVariantIds.filter((vid) => !incomingVariantIds.includes(vid))
		: [];
	const imageIdsToDelete = images.length
		? existingImageIds.filter((iid) => !incomingImageIds.includes(iid))
		: [];

	// 1. Delete removed images from cloudinary
	const imagesToDelete = product.images.filter((img) =>
		imageIdsToDelete.includes(img.id),
	);

	await Promise.all(
		imagesToDelete.map((img) => deleteFromCloudinary(img.publicId)),
	);

	// 2. Move new temp images to final folder
	const processedImages = await promoteImages(images);

	// 3. Decide whether this edit needs re-moderation.
	const changedMaterially = MATERIAL_FIELDS.some((field) => {
		if (field === "images") return images.length > 0;
		return (
			payload[field] !== undefined &&
			payload[field] !== product[field as keyof typeof product]
		);
	});

	const needsReReview =
		changedMaterially && product.status === ProductStatus.APPROVED;

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
				...(needsReReview
					? {
						status: ProductStatus.PENDING,
						submittedAt: new Date(),
						approvedAt: null,
						rejectionReason: null,
					}
					: {}),
			},
			include: {
				variants: true,
				images: true,
				vendor: { select: vendorCardSelect },
			},
		});

		return updated;
	});

	return updatedProduct;
};

/** Vendor sends a DRAFT or REJECTED listing to the moderation queue. */
const submitForReview = async (actor: TActor, id: string) => {
	const product =
		actor.role === Role.ADMIN
			? await prisma.product.findFirst({ where: { id, isDeleted: false } })
			: await assertVendorOwnsProduct(
				await resolveVendorScope(actor),
				id,
			);

	if (!product) {
		throw new CustomError(404, "Product not found");
	}

	if (product.status === ProductStatus.PENDING) {
		throw new CustomError(400, "This product is already awaiting review");
	}

	if (product.status === ProductStatus.APPROVED) {
		throw new CustomError(400, "This product is already approved");
	}

	return prisma.product.update({
		where: { id },
		data: {
			status: ProductStatus.PENDING,
			submittedAt: new Date(),
			rejectionReason: null,
		},
	});
};

/** Vendor's own show/hide switch. Independent of admin moderation. */
const setPublished = async (
	actor: TActor,
	id: string,
	isPublished: boolean,
) => {
	const product =
		actor.role === Role.ADMIN
			? await prisma.product.findFirst({ where: { id, isDeleted: false } })
			: await assertVendorOwnsProduct(
				await resolveVendorScope(actor),
				id,
			);

	if (!product) {
		throw new CustomError(404, "Product not found");
	}

	if (isPublished && product.status !== ProductStatus.APPROVED) {
		throw new CustomError(
			400,
			"Only an approved product can be published. Submit it for review first.",
		);
	}

	return prisma.product.update({
		where: { id },
		data: { isPublished },
	});
};

// ------------------------------------------------------------ admin moderation

const approveProduct = async (id: string) => {
	const product = await prisma.product.findFirst({
		where: { id, isDeleted: false },
	});

	if (!product) {
		throw new CustomError(404, "Product not found");
	}

	if (product.status === ProductStatus.APPROVED) {
		throw new CustomError(400, "This product is already approved");
	}

	return prisma.product.update({
		where: { id },
		data: {
			status: ProductStatus.APPROVED,
			approvedAt: new Date(),
			rejectionReason: null,
		},
	});
};

const rejectProduct = async (id: string, payload: TRejectProduct) => {
	const product = await prisma.product.findFirst({
		where: { id, isDeleted: false },
	});

	if (!product) {
		throw new CustomError(404, "Product not found");
	}

	return prisma.product.update({
		where: { id },
		data: {
			status: ProductStatus.REJECTED,
			rejectionReason: payload.reason,
			approvedAt: null,
			// A rejected listing must not stay on the storefront.
			isPublished: false,
		},
	});
};

const deleteData = async (actor: TActor, id: string) => {
	if (actor.role !== Role.ADMIN) {
		const vendorId = await resolveVendorScope(actor);
		await assertVendorOwnsProduct(vendorId, id);
	} else {
		await prisma.product.findUniqueOrThrow({ where: { id } });
	}

	const data = await prisma.product.update({
		where: { id },
		data: {
			isDeleted: true,
			isPublished: false,
		},
	});

	return data;
};

const newArrivalProducts = async () => {
	const products = await prisma.product.findMany({
		where: publicProductFilter(),
		orderBy: { createdAt: "desc" },
		take: 10,
		include: {
			images: true,
			variants: true,
			vendor: { select: vendorCardSelect },
		},
	});

	return products;
};

const relatedProducts = async (id: string) => {
	const product = await prisma.product.findFirstOrThrow({
		where: publicProductFilter({ id }),
		include: {
			category: true,
			brand: true,
		},
	});

	const referencePrice = Number(product.discountPrice ?? product.basePrice);

	const minPrice = referencePrice * 0.8;
	const maxPrice = referencePrice * 1.2;

	const products = await prisma.product.findMany({
		where: publicProductFilter({
			id: { not: id },
			AND: [
				{
					OR: [
						{
							discountPrice: {
								not: null,
								gte: minPrice,
								lte: maxPrice,
							},
						},
						{
							discountPrice: null,
							basePrice: { gte: minPrice, lte: maxPrice },
						},
					],
				},
			],
		}),
		take: 10,
		include: {
			images: {
				select: { id: true, url: true, isMain: true },
			},
			vendor: { select: vendorCardSelect },
		},
	});
	return products;
};

/** Storefront: everything one store currently sells. */
const findByVendorSlug = async (
	slug: string,
	query: Record<string, unknown>,
) => {
	const vendor = await prisma.vendor.findFirst({
		where: { slug, status: "APPROVED", isDeleted: false },
		select: { id: true },
	});

	if (!vendor) {
		throw new CustomError(404, "Store not found");
	}

	const builder = new PrismaQueryBuilder<Prisma.ProductWhereInput>(query);

	const prismaArgs = builder
		.withDefaultFilter(publicProductFilter({ vendorId: vendor.id }))
		.search(["name", "description"])
		.filter()
		.paginate()
		.sort()
		.include({
			images: { select: { id: true, url: true, isMain: true } },
			variants: true,
			category: { select: { id: true, name: true, slug: true } },
			brand: { select: { id: true, name: true } },
		})
		.build();

	const [products, meta] = await Promise.all([
		prisma.product.findMany(prismaArgs),
		builder.getMeta(prisma.product),
	]);

	return { meta, data: products };
};

export const productServices = {
	createIntoDB,
	findAllFromDB,
	findById,
	findBySlug,
	updateData,
	deleteData,
	//
	findMyProducts,
	findMyProductById,
	submitForReview,
	setPublished,
	//
	findAllForAdmin,
	approveProduct,
	rejectProduct,
	//
	newArrivalProducts,
	relatedProducts,
	findByVendorSlug,
};
