import { Order, OrderItem, PaymentStatus } from "../../generated/prisma";
import { prisma } from "../config/db";
import { generateTransactionId } from "./generateTransactionId";

export const createCODService = async (rest: Order, items: OrderItem[]) => {
	// count total price
	const totalAmount = items.reduce(
		(acc, item) => acc + Number(item.price) * item.quantity,
		0
	);

	return await prisma.$transaction(async (tx) => {
		const transactionId = generateTransactionId();

		// updating stock when they checkout
		for (const item of items) {
			if (item.variantId) {
				await tx.productVariant.update({
					where: { id: item.variantId },
					data: { stock: { decrement: item.quantity } },
				});
			} else {
				await tx.product.update({
					where: { id: item.productId },
					data: {
						stockQuantity: { decrement: item.quantity },
					},
				});
			}
		}
		// creating order
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

		// creating payment
		await tx.payment.create({
			data: {
				orderId: order.id,
				amount: totalAmount,
				method: rest.paymentMethod,
				status: PaymentStatus.PENDING,
				transactionId: transactionId,
			},
		});
	});
};
