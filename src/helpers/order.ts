import { prisma } from "../config/db";
import CustomError from "../utils/customError";
import {
    CartItemInput,
    OrderCalculation,
    ValidatedOrderItem,
} from "../types/common.types";
import {  OrderStatus } from "../../generated/prisma";
import { Prisma } from "@prisma/client";

const TAX_RATE = parseFloat(process.env.TAX_RATE || "0.08"); // 8%
const SHIPPING_COST = parseFloat(process.env.SHIPPING_COST || "10.00");
const FREE_SHIPPING_THRESHOLD = parseFloat(
    process.env.FREE_SHIPPING_THRESHOLD || "100.00",
);

/**
 * Generate unique order number
 * Format: ORD-YYYYMM-XXXXXX
 */
export async function generateOrderNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const prefix = `ORD-${year}${month}-`;

    let orderNumber: string | undefined;
    let exists = true;
    let attempts = 0;
    const maxAttempts = 10;

    while (exists && attempts < maxAttempts) {
        const random = Math.floor(Math.random() * 999999)
            .toString()
            .padStart(6, "0");
        orderNumber = `${prefix}${random}`;

        const existing = await prisma.order.findUnique({
            where: { orderNumber },
        });

        exists = !!existing;
        attempts++;
    }

    if (exists) {
        throw new CustomError(500, "Failed to generate unique order number");
    }

    return orderNumber as string;
}

/**
 * Validate cart items and fetch REAL prices from database
 * SECURITY: Never trust client prices!
 */
export async function validateAndCalculateOrder(
    items: CartItemInput[],
): Promise<OrderCalculation> {
    if (!items || items.length === 0) {
        throw new CustomError(400, "Cart is empty");
    }

    // Validate quantity limits
    for (const item of items) {
        if (item.quantity <= 0 || item.quantity > 9999) {
            throw new CustomError(
                400,
                `Invalid quantity ${item.quantity}. Must be between 1 and 9999`,
            );
        }
    }

    // Fetch all products in one query for efficiency
    const productIds = items.map((item) => item.productId);
    const products = await prisma.product.findMany({
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

    if (products.length !== new Set(productIds).size) {
        throw new CustomError(
            400,
            "One or more products not found or unavailable",
        );
    }

    const validatedItems: ValidatedOrderItem[] = [];
    let subtotal = 0;

    for (const item of items) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) {
            throw new CustomError(404, `Product ${item.productId} not found`);
        }

        let actualPrice: number;
        let originalPrice: number;
        let variantDetails: string | undefined;
        let availableStock: number;

        // Handle variant or base product
        if (item.variantId) {
            const variant = product.variants.find(
                (v) => v.id === item.variantId,
            );
            if (!variant) {
                throw new CustomError(
                    404,
                    `Variant ${item.variantId} not found for product ${product.name}`,
                );
            }

            // Calculate variant price (base + modifier)
            const basePrice = product.discountPrice || product.basePrice;
            actualPrice =
                parseFloat(basePrice.toString()) +
                parseFloat(variant.price.toString());
            originalPrice = parseFloat(product.basePrice.toString());
            availableStock = variant.stock;

            // Build variant details string
            const details = [];
            if (variant.color) details.push(variant.color);
            if (variant.sizeId) details.push(`Size ${variant.sizeId}`);
            variantDetails = details.join(", ");
        } else {
            // Use product price
            actualPrice = parseFloat(
                (product.discountPrice || product.basePrice).toString(),
            );
            originalPrice = parseFloat(product.basePrice.toString());
            availableStock = product.stockQuantity;
        }

        // Check stock availability
        if (availableStock < item.quantity) {
            throw new CustomError(
                400,
                `Insufficient stock for ${product.name}. Only ${availableStock} available.`,
            );
        }

        // Calculate discount
        const discount = originalPrice - actualPrice;
        const itemSubtotal = actualPrice * item.quantity;

        validatedItems.push({
            productId: product.id,
            productName: product.name,
            variantId: item.variantId,
            variantDetails,
            quantity: item.quantity,
            priceAtPurchase: actualPrice,
            originalPrice: originalPrice,
            discount: discount * item.quantity,
            subtotal: itemSubtotal,
        });

        subtotal += itemSubtotal;
    }

    // Calculate totals
    const tax = subtotal * TAX_RATE;
    const shippingCost =
        subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
    const discount = validatedItems.reduce(
        (sum, item) => sum + item.discount,
        0,
    );
    const totalAmount = subtotal + tax + shippingCost;

    return {
        items: validatedItems,
        subtotal,
        tax,
        shippingCost,
        discount,
        totalAmount,
    };
}


/**
 * Log order status changes
 */
export async function logStatusChange(
    tx: Prisma.TransactionClient,
    orderId: string,
    oldStatus: OrderStatus,
    newStatus: OrderStatus,
    changedBy: string,
    reason?: string,
    ipAddress?: string,
) {
    await tx.orderStatusHistory.create({
        data: {
            orderId,
            oldStatus,
            newStatus,
            changedBy,
            reason,
            ipAddress,
        },
    });
}
