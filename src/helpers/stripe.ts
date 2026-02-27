import Stripe from "stripe";
import { envConfig } from "../config/env-config";
import { ValidatedOrderItem } from "../types/common.types";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2025-07-30.basil",
});
interface OrderCalculation {
    items: ValidatedOrderItem[];
    subtotal: number;
    tax: number;
    shippingCost: number;
    totalAmount: number;
}

/**
 * Creates a Stripe Checkout payment URL
 */
export const createStripePaymentUrl = async (
    userId: string,
    shippingAddressId: string,
    calculation: OrderCalculation,
    orderNumber: string,
    ipAddress?: string,
    userAgent?: string,
    notes?: string,
): Promise<string> => {
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],

        billing_address_collection: "required",

        shipping_address_collection: {
            allowed_countries: ["US"],
        },

        phone_number_collection: {
            enabled: true,
        },

        line_items: calculation.items.map((item) => ({
            price_data: {
                currency: "USD",
                product_data: {
                    name: item.productName,
                },
                unit_amount: Math.round(item.priceAtPurchase * 100),
            },
            quantity: item.quantity,
        })),

        mode: "payment",

        success_url: `${envConfig.front_end_url}/payment-success?order=${orderNumber}`,
        cancel_url: `${envConfig.front_end_url}/payment-cancel?order=${orderNumber}`,

        metadata: {
            userId,
            shippingAddressId,
            orderNumber,
            totalAmount: calculation.totalAmount.toString(),
            ipAddress: ipAddress ?? "N/A",
            userAgent: userAgent ?? "N/A",
            notes: notes ?? "",
        },
    });

    if (!session.url) {
        throw new Error("Stripe session URL was not generated");
    }

    return session.url;
};
