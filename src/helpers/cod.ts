import {
	OrderStatus,
	PaymentMethod,
	PaymentStatus,
} from "../../generated/prisma";
import { prisma } from "../config/db";
import { CreateOrderInput, OrderCalculation } from "../types/common.types";
import CustomError from "../utils/customError";
import { logStatusChange } from "./order";

export async function createCODOrder(
	input: CreateOrderInput,
	calculation: OrderCalculation,
	orderNumber: string,
) {
	return prisma.$transaction(async (tx) => {
		// 0. Fetch shipping address for snapshot
		const shippingAddress = await tx.address.findUnique({
			where: { id: input.shippingAddressId },
		});

		if (!shippingAddress) {
			throw new CustomError(404, "Shipping address not found");
		}

		// 1. Deduct stock atomically
		for (const item of calculation.items) {
			if (item.variantId) {
				// Update variant stock
				const variant = await tx.productVariant.update({
					where: { id: item.variantId },
					data: { stock: { decrement: item.quantity } },
				});

				if (variant.stock < 0) {
					throw new CustomError(
						400,
						`Insufficient stock for ${item.productName}`,
					);
				}
			} else {
				// Update product stock
				const product = await tx.product.update({
					where: { id: item.productId },
					data: { stockQuantity: { decrement: item.quantity } },
				});

				if (product.stockQuantity < 0) {
					throw new CustomError(
						400,
						`Insufficient stock for ${item.productName}`,
					);
				}
			}
		}

		// 2. Create order
		const order = await tx.order.create({
			data: {
				orderNumber,
				userId: input.userId,
				subtotal: calculation.subtotal,
				tax: calculation.tax,
				shippingCost: calculation.shippingCost,
				totalAmount: calculation.totalAmount,
				paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
				paymentStatus: PaymentStatus.PENDING,
				orderStatus: OrderStatus.PENDING,
				shippingAddressId: input.shippingAddressId,
				shippingSnapshot: shippingAddress,
				ipAddress: input.ipAddress,
				userAgent: input.userAgent,
				notes: input.notes,
				items: {
					create: calculation.items.map((item) => ({
						productId: item.productId,
						productName: item.productName,
						variantId: item.variantId,
						variantDetails: item.variantDetails,
						quantity: item.quantity,
						priceAtPurchase: item.priceAtPurchase,
						originalPrice: item.originalPrice,
						// discount: item.discount,
						subtotal: item.subtotal,
					})),
				},
			},
			include: {
				items: true,
				shippingAddress: true,
				user: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
		});

		// 3. Create payment record
		await tx.payment.create({
			data: {
				orderId: order.id,
				amount: calculation.totalAmount,
				method: PaymentMethod.CASH_ON_DELIVERY,
				status: PaymentStatus.PENDING,
			},
		});

		// 4. Log status history
		await logStatusChange(
			tx,
			order.id,
			OrderStatus.PENDING,
			OrderStatus.PENDING,
			input.userId,
			input.ipAddress,
		);

		return order;
	});
}
