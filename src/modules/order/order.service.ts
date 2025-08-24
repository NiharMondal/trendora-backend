import {
	Order,
	OrderItem,
	OrderStatus,
	PaymentMethod,
	PaymentStatus,
	Prisma,
} from "../../../generated/prisma";
import { prisma } from "../../config/db";
import { envConfig } from "../../config/env-config";
import { ensureTransitionAllowed } from "../../helpers/allowedTransition";
import PrismaQueryBuilder from "../../lib/PrismaQueryBuilder";
import CustomError from "../../utils/customError";
import Stripe from "stripe";
type OrderPayloadRequest = {
	items: OrderItem[];
} & Order;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
	apiVersion: "2025-07-30.basil",
});

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

		let paymentUrl: string | null = null;

		// ---- STRIPE ----
		if (rest.paymentMethod === PaymentMethod.STRIPE) {
			const session = await stripe.checkout.sessions.create({
				payment_method_types: ["card"],
				line_items: items.map((item) => ({
					price_data: {
						currency: "USD",
						product_data: { name: `Product ${item.productId}` },
						unit_amount: Math.round(Number(item.price) * 100),
					},
					quantity: item.quantity,
				})),
				mode: "payment",
				success_url: `${envConfig.front_end_url}/payment-success`,
				cancel_url: `${envConfig.front_end_url}/payment-cancel`,
				metadata: {
					userId: rest.userId,
					shippingAddressId: rest.shippingAddressId,
					items: JSON.stringify(items),
				},
			});
			paymentUrl = session.url as string;
		}

		// ---- SSLCOMMERZ ----
		if (rest.paymentMethod === PaymentMethod.SSLCOMMERZ) {
		}

		// ---- CASH_ON_DELIVERY ----
		if (rest.paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
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

			await tx.payment.create({
				data: {
					orderId: order.id,
					amount: totalAmount,
					method: rest.paymentMethod,
					status: PaymentStatus.PENDING,
				},
			});
			paymentUrl = null;
		}

		return { paymentUrl };
	});
};

const findAllFromDB = async (query: Record<string, any>) => {
	const builder = new PrismaQueryBuilder<Prisma.OrderWhereInput>(query);

	const prismaArgs = builder.filter().paginate().build();

	const orders = await prisma.order.findMany(prismaArgs);
	const meta = await builder.getMeta(prisma.order);

	return { meta, orders };
};

const markOrderStatus = async (
	orderId: string,
	payload: { orderStatus: OrderStatus }
) => {
	const nextStatus = payload.orderStatus;
	return prisma.$transaction(async (tx) => {
		const order = await tx.order.findUnique({
			where: { id: orderId },
		});

		if (!order) throw new CustomError(400, "Order not found");

		// 1) State machine guard (no skipping / invalid moves)
		ensureTransitionAllowed(order.orderStatus, nextStatus);

		// 2) Payment guards
		const isPrepaid =
			order.paymentMethod === PaymentMethod.STRIPE ||
			order.paymentMethod === PaymentMethod.SSLCOMMERZ;

		if (
			nextStatus === OrderStatus.SHIPPED &&
			isPrepaid &&
			order.paymentStatus !== PaymentStatus.PAID
		) {
			throw new CustomError(
				400,
				"Cannot ship prepaid order until payment is PAID."
			);
		}

		if (
			nextStatus === OrderStatus.DELIVERED &&
			isPrepaid &&
			order.paymentStatus !== PaymentStatus.PAID
		) {
			throw new CustomError(
				400,
				"Cannot deliver prepaid order until payment is PAID."
			);
		}

		// 3) Compute payment updates based on transition
		let newPaymentStatus: PaymentStatus | undefined = undefined;

		if (nextStatus === OrderStatus.DELIVERED) {
			// COD becomes PAID at delivery-collection time
			if (order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
				newPaymentStatus = PaymentStatus.PAID;
			}
		}

		if (nextStatus === OrderStatus.CANCELED) {
			// If already paid, you should refund externally first, then set REFUNDED.
			// If not paid, mark FAILED (payment did not complete).
			newPaymentStatus =
				order.paymentStatus === PaymentStatus.PAID
					? PaymentStatus.REFUNDED
					: PaymentStatus.FAILED;
		}

		// 4) Apply updates atomically
		if (newPaymentStatus) {
			await tx.payment.update({
				where: { orderId },
				data: { status: newPaymentStatus },
			});
		}

		const updated = await tx.order.update({
			where: { id: orderId },
			data: {
				orderStatus: nextStatus,
				paymentStatus: newPaymentStatus ?? order.paymentStatus,
			},
			include: { items: true, payment: true },
		});

		return updated;
	});
};
export const orderServices = { createOrder, findAllFromDB, markOrderStatus };
