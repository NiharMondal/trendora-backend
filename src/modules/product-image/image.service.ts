import { prisma } from "../../config/db";

const findByProductId = async (productId: string) => {
	const variants = await prisma.productImage.findMany({
		where: {
			productId,
		},
	});

	return variants;
};

export const productImageServices = { findByProductId };
