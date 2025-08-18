import { Order, OrderItem } from "../../../generated/prisma";
import { prisma } from "../../config/db";
import CustomError from "../../utils/customError";

type OrderPayloadRequest = {
	items: OrderItem[];
} & Order;

const createOrder = async (payload: OrderPayloadRequest) => {
	const { items, ...rest } = payload;

	return await prisma.$transaction(async (tx) => {
		// checking product or variant stock
		for (const item of items) {
			if (item.variantId) {
				const variant = await tx.productVariant.findUnique({
					where: { id: item.variantId },
				});
				if (!variant || variant.stock < item.quantity) {
					throw new CustomError(
						400,
						`Insufficient stock for this variant`
					);
				}

				await tx.productVariant.update({
					where: { id: item.variantId },
					data: { stock: { decrement: item.quantity } },
				});
			} else {
				const product = await tx.product.findUnique({
					where: { id: item.productId },
				});
				if (!product || product.stockQuantity < item.quantity) {
					throw new CustomError(
						400,
						`Insufficient stock for this product`
					);
				}

				await tx.product.update({
					where: { id: item.productId },
					data: { stockQuantity: { decrement: item.quantity } },
				});
			}
		}
		// count total price
		const totalAmount = items.reduce(
			(acc, item) => acc + Number(item.price) * item.quantity,
			0
		);

		const order = await tx.order.create({
			data: {
				...rest,
				totalAmount,
				items: {
					create: items,
				},
			},
			include: { items: true },
		});

		const payment = await tx.payment.create({
			data: {
				orderId: order.id,
				amount: totalAmount,
				method: rest.paymentMethod,
			},
		});

		// STRIPE

		return { order, payment };
	});
};

export const orderServices = { createOrder };
