import { prisma } from "../config/db";
import CustomError from "../utils/customError";
import {
    CartItemInput,
    OrderCalculation,
    ValidatedOrderItem,
    VendorOrderCalculation,
} from "../types/common.types";
import { OrderStatus, Prisma } from "../../generated/prisma";
import { envConfig } from "../config/env-config";
import { round2, sumMoney, toNumber } from "./money";
import { publicProductFilter } from "./vendor";

const TAX_RATE = envConfig.tax_rate;

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

        // An order number is claimed by a checkout draft before the order row
        // exists, so both have to be clear for the number to be free.
        const [order, checkout] = await Promise.all([
            prisma.order.findUnique({ where: { orderNumber } }),
            prisma.checkoutSession.findUnique({ where: { orderNumber } }),
        ]);

        exists = !!order || !!checkout;
        attempts++;
    }

    if (exists) {
        throw new CustomError(500, "Failed to generate unique order number");
    }

    return orderNumber as string;
}

/**
 * Per-vendor suffix on the parent order number, e.g. ORD-202609-001234-V01.
 * Vendors are numbered in the order the groups appear in the calculation.
 */
export function buildVendorOrderNumber(
    orderNumber: string,
    index: number,
): string {
    return `${orderNumber}-V${String(index + 1).padStart(2, "0")}`;
}

/**
 * Validate cart items and price them from the database, grouped by vendor.
 *
 * SECURITY: prices, stock and vendor ownership all come from the DB — nothing
 * about money is taken from the client. A cart spanning several stores becomes
 * several VendorOrderCalculation groups, each shipped and paid out separately.
 *
 * The money formulas and their invariants are documented on
 * VendorOrderCalculation in src/types/common.types.ts.
 */
export async function validateAndCalculateOrder(
    items: CartItemInput[],
): Promise<OrderCalculation> {
    if (!items || items.length === 0) {
        throw new CustomError(400, "Cart is empty");
    }

    // Collapse duplicate cart lines so the same variant cannot pass the stock
    // check twice by arriving as two entries.
    const mergedItems = mergeCartItems(items);

    for (const item of mergedItems) {
        if (item.quantity <= 0 || item.quantity > 9999) {
            throw new CustomError(
                400,
                `Invalid quantity ${item.quantity}. Must be between 1 and 9999`,
            );
        }
    }

    // Fetch all products in one query for efficiency. `publicProductFilter`
    // also rejects products whose store is suspended or unapproved, so a
    // suspended vendor's listings cannot be bought even from a stale cart.
    const productIds = mergedItems.map((item) => item.productId);
    const products = await prisma.product.findMany({
        where: publicProductFilter({ id: { in: productIds } }),
        include: {
            vendor: {
                select: {
                    id: true,
                    storeName: true,
                    slug: true,
                    commissionRate: true,
                    shippingFee: true,
                    freeShippingThreshold: true,
                },
            },
            variants: {
                where: { isDeleted: false },
                include: {
                    size: {
                        select: { name: true },
                    },
                },
            },
        },
    });

    if (products.length !== new Set(productIds).size) {
        const found = new Set(products.map((product) => product.id));
        const missing = [...new Set(productIds)].filter(
            (id) => !found.has(id),
        );

        throw new CustomError(
            400,
            `One or more products are no longer available (${missing.join(", ")})`,
        );
    }

    const validatedItems: ValidatedOrderItem[] = [];

    for (const item of mergedItems) {
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

            const variantPrice = toNumber(variant.price);
            actualPrice =
                variantPrice > 0
                    ? variantPrice
                    : toNumber(product.discountPrice ?? product.basePrice);
            originalPrice = toNumber(product.basePrice);
            availableStock = variant.stock;

            // Build variant details string
            const details = [];
            if (variant.color) details.push(variant.color);
            if (variant.size) details.push(variant.size.name);
            variantDetails = details.join(", ");
        } else {
            // Use product price
            actualPrice = toNumber(product.discountPrice ?? product.basePrice);
            originalPrice = toNumber(product.basePrice);
            availableStock = product.stockQuantity;
        }

        // Check stock availability
        if (availableStock < item.quantity) {
            throw new CustomError(
                400,
                `Insufficient stock for ${product.name}. Only ${availableStock} available.`,
            );
        }

        validatedItems.push({
            productId: product.id,
            productName: product.name,
            vendorId: product.vendorId,
            variantId: item.variantId,
            variantDetails,
            quantity: item.quantity,
            priceAtPurchase: actualPrice,
            originalPrice,
            // Informational only — priceAtPurchase is already the discounted
            // price, so this must never be subtracted from a total again.
            discount: round2(
                Math.max(originalPrice - actualPrice, 0) * item.quantity,
            ),
            subtotal: round2(actualPrice * item.quantity),
        });
    }

    // ---- Group into one calculation per vendor -----------------------------
    const vendorSettings = new Map(
        products.map((product) => [product.vendorId, product.vendor]),
    );

    const grouped = new Map<string, ValidatedOrderItem[]>();
    for (const item of validatedItems) {
        const bucket = grouped.get(item.vendorId) ?? [];
        bucket.push(item);
        grouped.set(item.vendorId, bucket);
    }

    const vendors: VendorOrderCalculation[] = [...grouped.entries()].map(
        ([vendorId, vendorItems]) => {
            const settings = vendorSettings.get(vendorId);

            if (!settings) {
                throw new CustomError(
                    500,
                    "Vendor settings missing while pricing the order",
                );
            }

            const subtotal = sumMoney(vendorItems.map((i) => i.subtotal));
            const discount = sumMoney(vendorItems.map((i) => i.discount));

            // Shipping is per vendor: each store ships its own parcel, so each
            // store's threshold is evaluated against its own subtotal.
            const freeShippingThreshold = toNumber(
                settings.freeShippingThreshold,
            );
            const shippingCost =
                subtotal >= freeShippingThreshold
                    ? 0
                    : round2(toNumber(settings.shippingFee));

            const tax = round2(subtotal * TAX_RATE);
            const totalAmount = round2(subtotal + tax + shippingCost);

            const commissionRate = toNumber(settings.commissionRate);
            const commissionAmount = round2(subtotal * commissionRate);
            // Vendor keeps shipping; the platform keeps its commission and the
            // tax it has to remit.
            const vendorEarning = round2(
                subtotal + shippingCost - commissionAmount,
            );

            return {
                vendorId,
                vendorSlug: settings.slug,
                storeName: settings.storeName,
                items: vendorItems,
                subtotal,
                tax,
                shippingCost,
                discount,
                totalAmount,
                commissionRate,
                commissionAmount,
                vendorEarning,
            };
        },
    );

    const calculation: OrderCalculation = {
        vendors,
        items: validatedItems,
        subtotal: sumMoney(vendors.map((v) => v.subtotal)),
        tax: sumMoney(vendors.map((v) => v.tax)),
        shippingCost: sumMoney(vendors.map((v) => v.shippingCost)),
        discount: sumMoney(vendors.map((v) => v.discount)),
        totalAmount: sumMoney(vendors.map((v) => v.totalAmount)),
    };

    assertCalculationBalances(calculation);

    return calculation;
}

/**
 * Guards the invariants documented on VendorOrderCalculation.
 *
 * A silent rounding drift here becomes money that is charged to a buyer but
 * owed to nobody, so this fails loudly rather than storing an unbalanced order.
 */
function assertCalculationBalances(calculation: OrderCalculation): void {
    const cent = 0.005;

    for (const vendor of calculation.vendors) {
        const expectedTotal = round2(
            vendor.subtotal + vendor.tax + vendor.shippingCost,
        );
        const split = round2(vendor.commissionAmount + vendor.vendorEarning);
        const merchandiseAndShipping = round2(
            vendor.subtotal + vendor.shippingCost,
        );

        if (Math.abs(vendor.totalAmount - expectedTotal) > cent) {
            throw new CustomError(
                500,
                `Order pricing failed to balance for vendor ${vendor.vendorId}`,
            );
        }

        if (Math.abs(split - merchandiseAndShipping) > cent) {
            throw new CustomError(
                500,
                `Commission split failed to balance for vendor ${vendor.vendorId}`,
            );
        }
    }

    const summed = round2(
        calculation.subtotal + calculation.tax + calculation.shippingCost,
    );

    if (Math.abs(calculation.totalAmount - summed) > cent) {
        throw new CustomError(500, "Order total failed to balance");
    }
}

/** Collapses cart lines that point at the same product/variant pair. */
function mergeCartItems(items: CartItemInput[]): CartItemInput[] {
    const merged = new Map<string, CartItemInput>();

    for (const item of items) {
        const key = `${item.productId}:${item.variantId ?? ""}`;
        const existing = merged.get(key);

        if (existing) {
            existing.quantity += item.quantity;
        } else {
            merged.set(key, { ...item });
        }
    }

    return [...merged.values()];
}

/**
 * Log a status change.
 *
 * `vendorOrderId` is set for fulfilment events (the normal case) and left null
 * for order-level events such as "order created".
 */
export async function logStatusChange(
    tx: Prisma.TransactionClient,
    params: {
        orderId: string;
        vendorOrderId?: string | null;
        oldStatus: OrderStatus;
        newStatus: OrderStatus;
        /** Null for system-driven changes (e.g. the Stripe webhook). */
        userId?: string | null;
        note?: string;
        ipAddress?: string;
    },
) {
    await tx.orderStatusHistory.create({
        data: {
            orderId: params.orderId,
            vendorOrderId: params.vendorOrderId ?? null,
            oldStatus: params.oldStatus,
            newStatus: params.newStatus,
            userId: params.userId ?? null,
            note: params.note,
            ipAddress: params.ipAddress,
        },
    });
}

/**
 * Derive the parent Order.orderStatus from its vendor orders.
 *
 * Order.orderStatus is a rollup for buyer-facing lists and filtering; the
 * authoritative fulfilment state is per VendorOrder. Rules, in order:
 *   - every slice canceled            -> CANCELED
 *   - all live slices delivered       -> DELIVERED
 *   - all live slices shipped+        -> SHIPPED
 *   - any live slice past PENDING     -> PROCESSING
 *   - otherwise                       -> PENDING
 */
export function deriveOrderStatus(
    vendorStatuses: OrderStatus[],
): OrderStatus {
    if (vendorStatuses.length === 0) return OrderStatus.PENDING;

    const live = vendorStatuses.filter(
        (status) => status !== OrderStatus.CANCELED,
    );

    if (live.length === 0) return OrderStatus.CANCELED;

    if (live.every((status) => status === OrderStatus.DELIVERED)) {
        return OrderStatus.DELIVERED;
    }

    if (
        live.every(
            (status) =>
                status === OrderStatus.SHIPPED ||
                status === OrderStatus.DELIVERED,
        )
    ) {
        return OrderStatus.SHIPPED;
    }

    if (live.some((status) => status !== OrderStatus.PENDING)) {
        return OrderStatus.PROCESSING;
    }

    return OrderStatus.PENDING;
}

/**
 * Recompute the parent order's rollup status and money totals from its vendor
 * orders. Call this after any write that changes a VendorOrder — it is the only
 * thing that may write Order.orderStatus.
 */
export async function recalculateOrderRollup(
    tx: Prisma.TransactionClient,
    orderId: string,
) {
    const vendorOrders = await tx.vendorOrder.findMany({
        where: { orderId },
        select: {
            orderStatus: true,
            subtotal: true,
            tax: true,
            shippingCost: true,
            discount: true,
            totalAmount: true,
        },
    });

    const orderStatus = deriveOrderStatus(
        vendorOrders.map((vendorOrder) => vendorOrder.orderStatus),
    );

    return tx.order.update({
        where: { id: orderId },
        data: {
            orderStatus,
            subtotal: sumMoney(vendorOrders.map((v) => toNumber(v.subtotal))),
            tax: sumMoney(vendorOrders.map((v) => toNumber(v.tax))),
            shippingCost: sumMoney(
                vendorOrders.map((v) => toNumber(v.shippingCost)),
            ),
            discount: sumMoney(vendorOrders.map((v) => toNumber(v.discount))),
            totalAmount: sumMoney(
                vendorOrders.map((v) => toNumber(v.totalAmount)),
            ),
        },
    });
}
