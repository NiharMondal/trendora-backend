import { Prisma } from "@/lib/prisma-client";
import { prisma } from "@/config/db";
import { generateSlug } from "@/helpers/slug";
import PrismaQueryBuilder from "@/lib/PrismaQueryBuilder";

import { deleteFromCloudinary, moveFromTemp } from "@/utils/cloudinary";
import { capitalizeFirstLetter } from "@/utils/utils";
import { TCategory, TCategoryUpdate } from "./category.validation";

type TImagePayload = { url: string; publicId: string } | null | undefined;

/**
 * Turn the client's `{ url, publicId }` into the two columns that store it,
 * promoting the asset out of Cloudinary's `temp/` folder on the way.
 *
 * Three distinct cases, and conflating them loses data:
 *   `undefined` -> the field was not in the request; change nothing.
 *   `null`      -> the admin removed the picture; clear both columns.
 *   an object   -> set it, and destroy whatever it replaced.
 *
 * Only a publicId still containing `/temp/` is moved. A promoted asset is
 * live on the storefront, and renaming it again would break every URL already
 * rendered against it — the same guard the product and vendor services keep.
 */
const resolveImageColumns = async (
	image: TImagePayload,
	previousPublicId?: string | null,
): Promise<{ image?: string | null; imagePublicId?: string | null }> => {
	if (image === undefined) return {};

	if (image === null) {
		if (previousPublicId) await deleteFromCloudinary(previousPublicId);
		return { image: null, imagePublicId: null };
	}

	const stored = image.publicId.includes("/temp/")
		? await moveFromTemp(image.publicId)
		: { url: image.url, publicId: image.publicId };

	// Unchanged image on an unrelated edit — nothing to clean up.
	if (previousPublicId && previousPublicId !== stored.publicId) {
		await deleteFromCloudinary(previousPublicId);
	}

	return { image: stored.url, imagePublicId: stored.publicId };
};

const createIntoDB = async (payload: TCategory) => {
	// `image` arrives as a nested object; it maps onto two scalar columns, so
	// it must not reach Prisma inside the spread.
	const { image, ...rest } = payload;

	const name = capitalizeFirstLetter(payload.name.trim());
	const slug = generateSlug(payload.name);

	const data = await prisma.category.create({
		data: { ...rest, ...(await resolveImageColumns(image)), name, slug },
	});

	return data;
};

const findAllFromDB = async (query: Record<string, unknown>) => {
	const builder = new PrismaQueryBuilder<Prisma.CategoryWhereInput>(query, { model: "Category" });

	const prismaArgs = builder
		.withDefaultFilter({ isDeleted: false })
		.search(["name"])
		.filter()
		.paginate()
		.sort()
		.include({
			parent: {
				select: {
					id: true,
					name: true,
				},
			},
			sizeGroup: {
				select: {
					id: true,
					name: true,
				},
			},
		})
		.build();

	const [categories, meta] = await Promise.all([
		prisma.category.findMany(prismaArgs),
		builder.getMeta(prisma.category),
	]);

	return { meta, categories };
};

const findById = async (id: string) => {
	const category = await prisma.category.findUniqueOrThrow({
		where: { id },
		include: {
			parent: {
				select: { id: true, name: true },
			},
			sizeGroup: {
				select: {
					sizes: {
						select: {
							id: true,
							name: true,
						},
					},
				},
			},
		},
	});

	return category;
};

const updateData = async (id: string, payload: TCategoryUpdate) => {
	const category = await prisma.category.findUniqueOrThrow({
		where: { id },
	});

	const { image, ...rest } = payload;
	const slug = generateSlug(payload.name || category.name);

	const updatedData = await prisma.category.update({
		where: { id },
		data: {
			...rest,
			...(await resolveImageColumns(image, category.imagePublicId)),
			slug,
		},
	});
	return updatedData;
};

const deleteData = async (id: string) => {
	await prisma.category.findUniqueOrThrow({
		where: { id },
	});
	const data = await prisma.category.update({
		where: { id },
		data: {
			isDeleted: true,
		},
	});

	return data;
};

export const categoryServices = {
	createIntoDB,
	findAllFromDB,
	findById,
	updateData,
	deleteData,
};
