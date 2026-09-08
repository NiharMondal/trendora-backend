import Stripe from "stripe";
import { envConfig } from "../config/env-config";
import { OrderCalculation } from "../types/common.types";
import { round2 } from "./money";

const stripe = new Stripe(envConfig.stripe_secret_key as string, {
    apiVersion: "2025-07-30.basil",
});

/**
 * Creates a Stripe Checkout session for a priced, multi-vendor cart.
 *
 * Only `checkoutSessionId` and `orderNumber` go into metadata — the cart
 * itself is persisted as a CheckoutSession row (see ./checkout.ts), because
 * Stripe metadata is capped at 500 characters per value and cannot hold a
 * multi-vendor cart. The previous implementation relied on metadata fields the
 * webhook expected but nothing ever set, which meant no Stripe order was ever
 * created.
 *
 * Line items are the real per-item prices plus one line per vendor for
 * shipping and a single tax line, so the Stripe total matches the order total
 * to the cent and the webhook's amount check is meaningful.
 */
export const createStripePaymentUrl = async (params: {
    userId: string;
    checkoutSessionId: string;
    orderNumber: string;
    calculation: OrderCalculation;
}): Promise<{ url: string; stripeSessionId: string }> => {
    const { calculation } = params;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
        calculation.items.map((item) => ({
            price_data: {
                currency: "USD",
                product_data: {
                    name: item.variantDetails
                        ? `${item.productName} (${item.variantDetails})`
                        : item.productName,
                },
                unit_amount: toCents(item.priceAtPurchase),
            },
            quantity: item.quantity,
        }));

    // Shipping is per vendor, so it is itemised per store — the buyer can see
    // what each parcel costs rather than one opaque total.
    for (const vendor of calculation.vendors) {
        if (vendor.shippingCost > 0) {
            lineItems.push({
                price_data: {
                    currency: "USD",
                    product_data: { name: `Shipping — ${vendor.storeName}` },
                    unit_amount: toCents(vendor.shippingCost),
                },
                quantity: 1,
            });
        }
    }

    if (calculation.tax > 0) {
        lineItems.push({
            price_data: {
                currency: "USD",
                product_data: { name: "Tax" },
                unit_amount: toCents(calculation.tax),
            },
            quantity: 1,
        });
    }

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        billing_address_collection: "required",
        shipping_address_collection: {
            allowed_countries: ["US"],
        },
        phone_number_collection: {
            enabled: true,
        },
        line_items: lineItems,
        mode: "payment",
        success_url: `${envConfig.front_end_url}/payment-success?order=${params.orderNumber}`,
        cancel_url: `${envConfig.front_end_url}/payment-cancel?order=${params.orderNumber}`,
        metadata: {
            checkoutSessionId: params.checkoutSessionId,
            orderNumber: params.orderNumber,
            userId: params.userId,
        },
    });

    if (!session.url) {
        throw new Error("Stripe session URL was not generated");
    }

    return { url: session.url, stripeSessionId: session.id };
};

/** Stripe works in the currency's smallest unit. */
const toCents = (amount: number): number => Math.round(round2(amount) * 100);
