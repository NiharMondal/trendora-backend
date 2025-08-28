import Stripe from "stripe";
import { envConfig } from "../../config/env-config";
import CustomError from "../../utils/customError";
import { prisma } from "../../config/db";
import {
	OrderItem,
	PaymentMethod,
	PaymentStatus,
} from "../../../generated/prisma";

// stripe initialization
const stripe = new Stripe(envConfig.stripe_secret_key as string);

const createPaymentWithStripeWebhook = async (body: any, sig: any) => {
	let event;

	try {
		event = stripe.webhooks.constructEvent(
			body,
			sig,
			envConfig.stripe_webhook_secret as string
		);
	} catch (error) {
		throw new CustomError(400, `Webhook Error: ${error}`);
	}

	if (event.type === "checkout.session.completed") {
		const session = event.data.object as Stripe.Checkout.Session;

		if (!session.metadata?.items) {
			throw new CustomError(400, "No items found in session metadata.");
		}
		const items = JSON.parse(session.metadata.items) as OrderItem[];

		const userId = session.metadata?.userId;
		const shippingAddressId = session.metadata?.shippingAddressId;
		const paymentIntentId = session.payment_intent as string;

		await prisma.$transaction(async (tx) => {
			// updating product or variant stock
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
					userId: userId,
					paymentMethod: PaymentMethod.STRIPE,
					shippingAddressId: shippingAddressId,
					paymentStatus: PaymentStatus.PAID,
					totalAmount: Number(session.amount_total) / 100,
					items: { create: items },
				},
			});

			//creating payment
			await tx.payment.create({
				data: {
					orderId: order.id,
					amount: order.totalAmount,
					method: PaymentMethod.STRIPE,
					status: PaymentStatus.PAID,
					transactionId: paymentIntentId,
				},
			});

			return order;
		});
	}
};

export const paymentServices = {
	createPaymentWithStripeWebhook,
};
