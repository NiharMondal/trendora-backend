import {
	Order,
	OrderItem,
	OrderStatus,
	PaymentMethod,
	PaymentStatus,
	Prisma,
} from "../../../generated/prisma";
import { prisma } from "../../config/db";

import { ensureTransitionAllowed } from "../../helpers/allowedTransition";
import PrismaQueryBuilder from "../../lib/PrismaQueryBuilder";
import CustomError from "../../utils/customError";
import { createStripePaymentUrl } from "../../helpers/stripe";
import { createCODService } from "../../helpers/cod";

type OrderPayloadRequest = {
	items: OrderItem[];
} & Order;

const createOrder = async (payload: OrderPayloadRequest) => {
	const { items, ...rest } = payload;

	const user = await prisma.user.findUnique({
		where: { id: rest.userId },
	});
	if (!user) {
		throw new CustomError(400, "User is not found!");
	}

	const shippingAddress = await prisma.address.findUnique({
		where: { id: rest.shippingAddressId },
	});

	if (!shippingAddress) {
		throw new CustomError(400, "Shipping address is not found!");
	}

	const result = await prisma.$transaction(async (tx) => {
		let paymentUrl: string | null = null;

		// checking product and  variant stock

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
			}
		}

		// ---- STRIPE ----
		if (rest.paymentMethod === PaymentMethod.STRIPE) {
			const url = await createStripePaymentUrl(
				rest.userId,
				rest.shippingAddressId,
				payload.items
			);
			paymentUrl = url;
		}

		// ---- CASH_ON_DELIVERY ----
		if (rest.paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
			await createCODService(rest, items);
			paymentUrl = null;
		}

		return { paymentUrl };
	});

	return result;
};

const findAllFromDB = async (query: Record<string, any>) => {
	const builder = new PrismaQueryBuilder<Prisma.OrderWhereInput>(query);

	const prismaArgs = builder.filter().paginate().build();

	const orders = await prisma.order.findMany(prismaArgs);
	const meta = await builder.getMeta(prisma.order);

	return { meta, orders };
};

const getMyOrder = async (userId: string, query: Record<string, any>) => {
	const builder = new PrismaQueryBuilder<Prisma.OrderWhereInput>(query);

	const prismaArgs = builder
		.withDefaultFilter({ userId })
		.filter()
		.paginate()
		.build();

	const myOrders = await prisma.order.findMany(prismaArgs);
	const meta = await builder.getMeta(prisma.order);

	return { meta, myOrders };
};

// this is only for CASH_ON_DELIVERY process
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
		const isPrepaid = order.paymentMethod === PaymentMethod.STRIPE;

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

export const orderServices = {
	createOrder,
	findAllFromDB,
	getMyOrder,
	markOrderStatus,
};
