import Stripe from "stripe";
import { envConfig } from "../../config/env-config";
import CustomError from "../../utils/customError";
import { prisma } from "../../config/db";
import {
	OrderItem,
	PaymentMethod,
	PaymentStatus,
} from "../../../generated/prisma";

const SSLCommerzPayment = require("sslcommerz-lts");

const store_id = envConfig.ssl.storeId;
const store_passwd = envConfig.ssl.storePass;
const is_live = false; //true for live, false for sandbox

// stripe initialization
const stripe = new Stripe(envConfig.stripe_secret_key as string);

// ssl-commerz initialization
const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
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

	try {
		if (event.type === "checkout.session.completed") {
			const session = event.data.object as Stripe.Checkout.Session;

			if (!session.metadata?.items) {
				throw new CustomError(
					400,
					"No items found in session metadata."
				);
			}
			const items = JSON.parse(session.metadata.items) as OrderItem;
			const userId = session.metadata?.userId;
			const shippingAddressId = session.metadata?.shippingAddressId;
			const paymentIntentId = session.payment_intent as string;
			await prisma.$transaction(async (tx) => {
				const order = await tx.order.create({
					data: {
						userId: userId,
						paymentMethod: PaymentMethod.STRIPE,
						shippingAddressId,
						paymentStatus: PaymentStatus.PAID,
						totalAmount: Number(session.amount_total) / 100,
						items: { create: items },
					},
				});
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
	} catch (error) {
		console.error(`Webhook processing error` + error);
		throw new CustomError(500, "Failed to process webhook");
	}
};
const createPaymentWithSSL = async (query: Record<string, any>) => {
	if (!query || !query.status || !(query.status === "VALID")) {
		throw new CustomError(400, "Payment is not valid");
	}
	const data = {
		val_id: query.val_id,
	};
	const response = await sslcz.validate(data);
};
export const paymentServices = {
	createPaymentWithStripeWebhook,
	createPaymentWithSSL,
};
