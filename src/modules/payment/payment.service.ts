import Stripe from "stripe";
import { envConfig } from "../../config/env-config";
import CustomError from "../../utils/customError";

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
};

export const paymentServices = { createPaymentWithStripeWebhook };
