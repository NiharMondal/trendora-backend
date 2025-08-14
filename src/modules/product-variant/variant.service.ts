import { ProductVariant } from "../../../generated/prisma";
import { prisma } from "../../config/db";

const findByProductId = async (productId: string) => {
	const variants = await prisma.productVariant.findMany({
		where: {
			productId,
		},
	});

	return variants;
};

const addVariants = async (productId: string, payload: ProductVariant[]) => {
	const variants = await prisma.productVariant.createMany({
		data: payload.map((v) => ({
			...v,
			productId,
		})),
	});

	return variants;
};

const updateVariant = async (id: string, payload: Partial<ProductVariant>) => {
	await prisma.productVariant.findUniqueOrThrow({ where: { id } });

	const updatedData = await prisma.productVariant.update({
		where: { id },
		data: {
			...payload,
		},
	});

	return updatedData;
};

const deleteVariant = async (id: string) => {
	const variant = await prisma.productVariant.update({
		where: { id },
		data: {
			isDeleted: true,
		},
	});

	return variant;
};
export const variantServices = {
	findByProductId,
	addVariants,
	updateVariant,
	deleteVariant,
};
