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
export const variantServices = { findByProductId, addVariants };
