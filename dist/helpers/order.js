"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOrderNumber = generateOrderNumber;
exports.buildVendorOrderNumber = buildVendorOrderNumber;
exports.validateAndCalculateOrder = validateAndCalculateOrder;
exports.logStatusChange = logStatusChange;
exports.deriveOrderStatus = deriveOrderStatus;
exports.recalculateOrderRollup = recalculateOrderRollup;
const db_1 = require("../config/db.js");
const customError_1 = __importDefault(require("../utils/customError.js"));
const prisma_client_1 = require("../lib/prisma-client.js");
const env_config_1 = require("../config/env-config.js");
const money_1 = require("./money");
const vendor_1 = require("./vendor");
const TAX_RATE = env_config_1.envConfig.tax_rate;
/**
 * Generate unique order number
 * Format: ORD-YYYYMM-XXXXXX
 */
async function generateOrderNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const prefix = `ORD-${year}${month}-`;
    let orderNumber;
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
            db_1.prisma.order.findUnique({ where: { orderNumber } }),
            db_1.prisma.checkoutSession.findUnique({ where: { orderNumber } }),
        ]);
        exists = !!order || !!checkout;
        attempts++;
    }
    if (exists) {
        throw new customError_1.default(500, "Failed to generate unique order number");
    }
    return orderNumber;
}
/**
 * Per-vendor suffix on the parent order number, e.g. ORD-202609-001234-V01.
 * Vendors are numbered in the order the groups appear in the calculation.
 */
function buildVendorOrderNumber(orderNumber, index) {
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
async function validateAndCalculateOrder(items) {
    if (!items || items.length === 0) {
        throw new customError_1.default(400, "Cart is empty");
    }
    // Collapse duplicate cart lines so the same variant cannot pass the stock
    // check twice by arriving as two entries.
    const mergedItems = mergeCartItems(items);
    for (const item of mergedItems) {
        if (item.quantity <= 0 || item.quantity > 9999) {
            throw new customError_1.default(400, `Invalid quantity ${item.quantity}. Must be between 1 and 9999`);
        }
    }
    // Fetch all products in one query for efficiency. `publicProductFilter`
    // also rejects products whose store is suspended or unapproved, so a
    // suspended vendor's listings cannot be bought even from a stale cart.
    const productIds = mergedItems.map((item) => item.productId);
    const products = await db_1.prisma.product.findMany({
        where: (0, vendor_1.publicProductFilter)({ id: { in: productIds } }),
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
            // Tax is per category, so it has to be read with the product.
            category: { select: { id: true, taxRate: true } },
        },
    });
    if (products.length !== new Set(productIds).size) {
        const found = new Set(products.map((product) => product.id));
        const missing = [...new Set(productIds)].filter((id) => !found.has(id));
        throw new customError_1.default(400, `One or more products are no longer available (${missing.join(", ")})`);
    }
    const validatedItems = [];
    for (const item of mergedItems) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) {
            throw new customError_1.default(404, `Product ${item.productId} not found`);
        }
        let actualPrice;
        let originalPrice;
        let variantDetails;
        let availableStock;
        // Handle variant or base product
        if (item.variantId) {
            const variant = product.variants.find((v) => v.id === item.variantId);
            if (!variant) {
                throw new customError_1.default(404, `Variant ${item.variantId} not found for product ${product.name}`);
            }
            const variantPrice = (0, money_1.toNumber)(variant.price);
            actualPrice =
                variantPrice > 0
                    ? variantPrice
                    : (0, money_1.toNumber)(product.discountPrice ?? product.basePrice);
            originalPrice = (0, money_1.toNumber)(product.basePrice);
            availableStock = variant.stock;
            // Build variant details string
            const details = [];
            if (variant.color)
                details.push(variant.color);
            if (variant.size)
                details.push(variant.size.name);
            variantDetails = details.join(", ");
        }
        else {
            // Use product price
            actualPrice = (0, money_1.toNumber)(product.discountPrice ?? product.basePrice);
            originalPrice = (0, money_1.toNumber)(product.basePrice);
            availableStock = product.stockQuantity;
        }
        // Check stock availability
        if (availableStock < item.quantity) {
            throw new customError_1.default(400, `Insufficient stock for ${product.name}. Only ${availableStock} available.`);
        }
        /**
         * The category's own rate, falling back to the platform rate when it
         * has none. `null` means "use the platform rate"; `0` is a real value
         * meaning zero-rated, so the check is against null, not falsiness.
         */
        const taxRate = product.category?.taxRate === null ||
            product.category?.taxRate === undefined
            ? TAX_RATE
            : (0, money_1.toNumber)(product.category.taxRate);
        const lineSubtotal = (0, money_1.round2)(actualPrice * item.quantity);
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
            discount: (0, money_1.round2)(Math.max(originalPrice - actualPrice, 0) * item.quantity),
            subtotal: lineSubtotal,
            taxRate,
            tax: (0, money_1.round2)(lineSubtotal * taxRate),
        });
    }
    // ---- Group into one calculation per vendor -----------------------------
    const vendorSettings = new Map(products.map((product) => [product.vendorId, product.vendor]));
    const grouped = new Map();
    for (const item of validatedItems) {
        const bucket = grouped.get(item.vendorId) ?? [];
        bucket.push(item);
        grouped.set(item.vendorId, bucket);
    }
    const vendors = [...grouped.entries()].map(([vendorId, vendorItems]) => {
        const settings = vendorSettings.get(vendorId);
        if (!settings) {
            throw new customError_1.default(500, "Vendor settings missing while pricing the order");
        }
        const subtotal = (0, money_1.sumMoney)(vendorItems.map((i) => i.subtotal));
        const discount = (0, money_1.sumMoney)(vendorItems.map((i) => i.discount));
        // Shipping is per vendor: each store ships its own parcel, so each
        // store's threshold is evaluated against its own subtotal.
        const freeShippingThreshold = (0, money_1.toNumber)(settings.freeShippingThreshold);
        const shippingCost = subtotal >= freeShippingThreshold
            ? 0
            : (0, money_1.round2)((0, money_1.toNumber)(settings.shippingFee));
        /**
         * Summed from the lines, not `subtotal * rate` — two products in
         * one parcel can be taxed differently.
         *
         * The exact per-line products are summed and rounded once, so a
         * parcel whose categories all use the platform rate still produces
         * exactly the old `round2(subtotal * TAX_RATE)`. Changing a rate is
         * the only thing that changes a total.
         */
        const tax = (0, money_1.round2)(vendorItems.reduce((total, i) => total + i.subtotal * i.taxRate, 0));
        const totalAmount = (0, money_1.round2)(subtotal + tax + shippingCost);
        const commissionRate = (0, money_1.toNumber)(settings.commissionRate);
        const commissionAmount = (0, money_1.round2)(subtotal * commissionRate);
        // Vendor keeps shipping; the platform keeps its commission and the
        // tax it has to remit.
        const vendorEarning = (0, money_1.round2)(subtotal + shippingCost - commissionAmount);
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
    });
    const calculation = {
        vendors,
        items: validatedItems,
        subtotal: (0, money_1.sumMoney)(vendors.map((v) => v.subtotal)),
        tax: (0, money_1.sumMoney)(vendors.map((v) => v.tax)),
        shippingCost: (0, money_1.sumMoney)(vendors.map((v) => v.shippingCost)),
        discount: (0, money_1.sumMoney)(vendors.map((v) => v.discount)),
        totalAmount: (0, money_1.sumMoney)(vendors.map((v) => v.totalAmount)),
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
function assertCalculationBalances(calculation) {
    const cent = 0.005;
    for (const vendor of calculation.vendors) {
        const expectedTotal = (0, money_1.round2)(vendor.subtotal + vendor.tax + vendor.shippingCost);
        const split = (0, money_1.round2)(vendor.commissionAmount + vendor.vendorEarning);
        const merchandiseAndShipping = (0, money_1.round2)(vendor.subtotal + vendor.shippingCost);
        if (Math.abs(vendor.totalAmount - expectedTotal) > cent) {
            throw new customError_1.default(500, `Order pricing failed to balance for vendor ${vendor.vendorId}`);
        }
        if (Math.abs(split - merchandiseAndShipping) > cent) {
            throw new customError_1.default(500, `Commission split failed to balance for vendor ${vendor.vendorId}`);
        }
    }
    const summed = (0, money_1.round2)(calculation.subtotal + calculation.tax + calculation.shippingCost);
    if (Math.abs(calculation.totalAmount - summed) > cent) {
        throw new customError_1.default(500, "Order total failed to balance");
    }
}
/** Collapses cart lines that point at the same product/variant pair. */
function mergeCartItems(items) {
    const merged = new Map();
    for (const item of items) {
        const key = `${item.productId}:${item.variantId ?? ""}`;
        const existing = merged.get(key);
        if (existing) {
            existing.quantity += item.quantity;
        }
        else {
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
async function logStatusChange(tx, params) {
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
function deriveOrderStatus(vendorStatuses) {
    if (vendorStatuses.length === 0)
        return prisma_client_1.OrderStatus.PENDING;
    const live = vendorStatuses.filter((status) => status !== prisma_client_1.OrderStatus.CANCELED);
    if (live.length === 0)
        return prisma_client_1.OrderStatus.CANCELED;
    if (live.every((status) => status === prisma_client_1.OrderStatus.DELIVERED)) {
        return prisma_client_1.OrderStatus.DELIVERED;
    }
    if (live.every((status) => status === prisma_client_1.OrderStatus.SHIPPED ||
        status === prisma_client_1.OrderStatus.DELIVERED)) {
        return prisma_client_1.OrderStatus.SHIPPED;
    }
    if (live.some((status) => status !== prisma_client_1.OrderStatus.PENDING)) {
        return prisma_client_1.OrderStatus.PROCESSING;
    }
    return prisma_client_1.OrderStatus.PENDING;
}
/**
 * Recompute the parent order's rollup status and money totals from its vendor
 * orders. Call this after any write that changes a VendorOrder — it is the only
 * thing that may write Order.orderStatus.
 */
async function recalculateOrderRollup(tx, orderId) {
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
    const orderStatus = deriveOrderStatus(vendorOrders.map((vendorOrder) => vendorOrder.orderStatus));
    return tx.order.update({
        where: { id: orderId },
        data: {
            orderStatus,
            subtotal: (0, money_1.sumMoney)(vendorOrders.map((v) => (0, money_1.toNumber)(v.subtotal))),
            tax: (0, money_1.sumMoney)(vendorOrders.map((v) => (0, money_1.toNumber)(v.tax))),
            shippingCost: (0, money_1.sumMoney)(vendorOrders.map((v) => (0, money_1.toNumber)(v.shippingCost))),
            discount: (0, money_1.sumMoney)(vendorOrders.map((v) => (0, money_1.toNumber)(v.discount))),
            totalAmount: (0, money_1.sumMoney)(vendorOrders.map((v) => (0, money_1.toNumber)(v.totalAmount))),
        },
    });
}
