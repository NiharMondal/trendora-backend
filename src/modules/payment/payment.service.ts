/* eslint-disable @typescript-eslint/no-explicit-any */
import Stripe from "stripe";
import { envConfig } from "../../config/env-config";
import CustomError from "../../utils/customError";
import { prisma } from "../../config/db";
import {
    PaymentMethod,
    PaymentStatus,
    OrderStatus,
    InventoryType,
} from "../../../generated/prisma";
import { ValidatedOrderItem } from "../../types/common.types";
import { logInventoryChange, logStatusChange } from "../../helpers/order";

// Initialize Stripe
const stripe = new Stripe(envConfig.stripe_secret_key as string, {
    apiVersion: "2025-07-30.basil",
});
/**
 * Handle Stripe webhook events
 * SECURITY: Verifies webhook signature to prevent tampering
 */
const handleStripeWebhook = async (body: any, signature: string) => {
    let event: Stripe.Event;

    // 1. Verify webhook signature
    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            envConfig.stripe_webhook_secret as string,
        );
    } catch (error: any) {
        console.error("Webhook signature verification failed:", error.message);
        throw new CustomError(400, `Webhook Error: ${error.message}`);
    }

    // 2. Handle different event types
    switch (event.type) {
        case "checkout.session.completed":
            await handleCheckoutSessionCompleted(
                event.data.object as Stripe.Checkout.Session,
            );
            break;

        case "payment_intent.succeeded":
            await handlePaymentIntentSucceeded(
                event.data.object as Stripe.PaymentIntent,
            );
            break;

        case "payment_intent.payment_failed":
            await handlePaymentIntentFailed(
                event.data.object as Stripe.PaymentIntent,
            );
            break;

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
};

/**
 * Handle successful checkout session
 */
async function handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
) {
    console.log("Processing checkout session:", session.id);

    // 1. Validate metadata exists
    if (!session.metadata) {
        throw new CustomError(400, "Session metadata is missing");
    }

    const {
        userId,
        shippingAddressId,
        orderNumber,
        items: itemsJson,
        subtotal,
        tax,
        shippingCost,
        discount,
        totalAmount,
        ipAddress,
        userAgent,
        notes,
    } = session.metadata;

    // 2. Validate required fields
    if (!userId || !shippingAddressId || !orderNumber || !itemsJson) {
        throw new CustomError(400, "Required metadata fields are missing");
    }

    // 3. Parse items
    const items: ValidatedOrderItem[] = JSON.parse(itemsJson);

    // 4. Validate amounts match (SECURITY: prevent tampering)
    const sessionAmount = (session?.amount_total as number) / 100; // Convert from cents
    const expectedAmount = parseFloat(totalAmount);

    if (Math.abs(sessionAmount - expectedAmount) > 0.01) {
        throw new CustomError(
            400,
            `Amount mismatch: session=${sessionAmount}, expected=${expectedAmount}`,
        );
    }

    // 5. Check if order already exists (idempotency)
    const existingOrder = await prisma.order.findUnique({
        where: { orderNumber },
    });

    if (existingOrder) {
        console.log(`Order ${orderNumber} already exists, skipping creation`);
        return;
    }

    // 6. Get payment intent ID
    const paymentIntentId = session.payment_intent as string;

    // 7. Create order in transaction
    await prisma.$transaction(async (tx) => {
        // Re-fetch products to validate prices haven't changed
        const productIds = items.map((item) => item.productId);
        const products = await tx.product.findMany({
            where: {
                id: { in: productIds },
                isPublished: true,
                isDeleted: false,
            },
            include: {
                variants: {
                    where: { isDeleted: false },
                },
            },
        });

        // Validate each item
        for (const item of items) {
            const product = products.find((p) => p.id === item.productId);
            if (!product) {
                throw new CustomError(
                    400,
                    `Product ${item.productId} not found or unavailable`,
                );
            }

            let currentPrice: number;
            let availableStock: number;

            if (item.variantId) {
                const variant = product.variants.find(
                    (v) => v.id === item.variantId,
                );
                if (!variant) {
                    throw new CustomError(
                        400,
                        `Variant ${item.variantId} not found`,
                    );
                }

                const basePrice = product.discountPrice || product.basePrice;
                currentPrice =
                    parseFloat(basePrice.toString()) +
                    parseFloat(variant.priceModifier.toString());
                availableStock = variant.stock;
            } else {
                currentPrice = parseFloat(
                    (product.discountPrice || product.basePrice).toString(),
                );
                availableStock = product.stockQuantity;
            }

            // SECURITY: Verify price hasn't changed significantly
            if (Math.abs(currentPrice - item.priceAtPurchase) > 0.01) {
                console.warn(
                    `Price changed for ${item.productName}: session=${item.priceAtPurchase}, current=${currentPrice}`,
                );
                // You can decide to fail or accept the session price
                // For now, we'll log but accept since payment already processed
            }

            // Check stock
            if (availableStock < item.quantity) {
                throw new CustomError(
                    400,
                    `Insufficient stock for ${item.productName}`,
                );
            }

            // Deduct stock
            if (item.variantId) {
                await tx.productVariant.update({
                    where: { id: item.variantId },
                    data: { stock: { decrement: item.quantity } },
                });

                await logInventoryChange(
                    tx,
                    item.productId,
                    item.variantId,
                    item.quantity,
                    InventoryType.SALE,
                    orderNumber,
                    "Stripe order completed",
                );
            } else {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stockQuantity: { decrement: item.quantity } },
                });

                await logInventoryChange(
                    tx,
                    item.productId,
                    undefined,
                    item.quantity,
                    InventoryType.SALE,
                    orderNumber,
                    "Stripe order completed",
                );
            }
        }

        // Create order
        const order = await tx.order.create({
            data: {
                orderNumber,
                userId,
                subtotal: parseFloat(subtotal),
                tax: parseFloat(tax),
                shippingCost: parseFloat(shippingCost),
                discount: parseFloat(discount),
                totalAmount: parseFloat(totalAmount),
                paymentMethod: PaymentMethod.STRIPE,
                paymentStatus: PaymentStatus.PAID,
                orderStatus: OrderStatus.PROCESSING, // Automatically move to PROCESSING
                shippingAddressId,
                ipAddress,
                userAgent,
                notes,
                items: {
                    create: items.map((item) => ({
                        productId: item.productId,
                        productName: item.productName,
                        variantId: item.variantId,
                        variantDetails: item.variantDetails,
                        quantity: item.quantity,
                        priceAtPurchase: item.priceAtPurchase,
                        originalPrice: item.originalPrice,
                        discount: item.discount,
                        subtotal: item.subtotal,
                    })),
                },
            },
        });

        // Create payment record
        await tx.payment.create({
            data: {
                orderId: order.id,
                amount: parseFloat(totalAmount),
                method: PaymentMethod.STRIPE,
                status: PaymentStatus.PAID,
                transactionId: paymentIntentId,
                paymentGateway: "stripe",
                gatewayResponse: session as any, // Store full session
                paidAt: new Date(),
            },
        });

        // Log initial status
        await logStatusChange(
            tx,
            order.id,
            OrderStatus.PENDING,
            OrderStatus.PENDING,
            "SYSTEM",
            "Order created via Stripe",
            ipAddress,
        );

        // Log automatic transition to PROCESSING
        await logStatusChange(
            tx,
            order.id,
            OrderStatus.PENDING,
            OrderStatus.PROCESSING,
            "SYSTEM",
            "Payment confirmed - moved to processing",
            ipAddress,
        );

        console.log(`Order ${orderNumber} created successfully`);

        return order;
    });
}

/**
 * Handle successful payment intent (backup/additional logging)
 */
async function handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
) {
    console.log("Payment intent succeeded:", paymentIntent.id);

    // Update payment record if it exists
    const payment = await prisma.payment.findUnique({
        where: { transactionId: paymentIntent.id },
    });

    if (payment) {
        await prisma.payment.update({
            where: { id: payment.id },
            data: {
                status: PaymentStatus.PAID,
                paidAt: new Date(),
                gatewayResponse: paymentIntent as any,
            },
        });
    }
}

/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    console.log("Payment intent failed:", paymentIntent.id);

    // Find and update payment record
    const payment = await prisma.payment.findUnique({
        where: { transactionId: paymentIntent.id },
    });

    if (payment) {
        await prisma.payment.update({
            where: { id: payment.id },
            data: {
                status: PaymentStatus.FAILED,
                failureReason: paymentIntent.last_payment_error?.message,
                gatewayResponse: paymentIntent as any,
            },
        });

        // Update order status
        await prisma.order.update({
            where: { id: payment.orderId },
            data: {
                paymentStatus: PaymentStatus.FAILED,
            },
        });
    }
}

export const paymentServices = {
    handleStripeWebhook,
};
