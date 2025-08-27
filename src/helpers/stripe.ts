import Stripe from "stripe";
import { OrderItem } from "../../generated/prisma";
import { envConfig } from "../config/env-config";

// stripe integration
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
	apiVersion: "2025-07-30.basil",
});

export const createStripePaymentUrl = async (
	userId: string,
	shippingAddressId: string,
	items: OrderItem[]
) => {
	const session = await stripe.checkout.sessions.create({
		payment_method_types: ["card"],
		billing_address_collection: "required",
		shipping_address_collection: {
			allowed_countries: ["US"],
		},
		phone_number_collection: {
			enabled: true,
		},
		line_items: items.map((item) => ({
			price_data: {
				currency: "USD",
				product_data: {
					name: item.productName,
				},
				unit_amount: Math.round(Number(item.price) * 100),
			},
			quantity: item.quantity,
		})),
		mode: "payment",
		success_url: `${envConfig.front_end_url}/payment-success`,
		cancel_url: `${envConfig.front_end_url}/payment-cancel`,
		metadata: {
			userId: userId,
			shippingAddressId: shippingAddressId,
			items: JSON.stringify(items),
		},
	});
	return session.url as string;
};
