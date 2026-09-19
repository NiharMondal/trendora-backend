"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistOrder = persistOrder;
const prisma_1 = require("../../generated/prisma");
const customError_1 = __importDefault(require("../utils/customError"));
const order_1 = require("./order");
const order_2 = require("./order");
async function persistOrder(tx, input) {
    const { calculation } = input;
    if (calculation.vendors.length === 0) {
        throw new customError_1.default(400, "Cannot create an order with no items");
    }
    // 0. Snapshot the shipping address, so a later edit or delete of the
    //    address row never rewrites what this order was shipped to.
    const shippingAddress = await tx.address.findUnique({
        where: { id: input.shippingAddressId },
    });
    if (!shippingAddress) {
        throw new customError_1.default(404, "Shipping address not found");
    }
    // 1. Deduct stock. The `gte` guard makes each update conditional, so a
    //    concurrent order cannot drive stock negative — we detect the loss and
    //    abort the whole transaction instead of writing an oversold order.
    for (const item of calculation.items) {
        if (item.variantId) {
            const updated = await tx.productVariant.updateMany({
                where: { id: item.variantId, stock: { gte: item.quantity } },
                data: { stock: { decrement: item.quantity } },
            });
            if (updated.count === 0) {
                throw new customError_1.default(400, `Insufficient stock for ${item.productName}`);
            }
        }
        else {
            const updated = await tx.product.updateMany({
                where: {
                    id: item.productId,
                    stockQuantity: { gte: item.quantity },
                },
                data: { stockQuantity: { decrement: item.quantity } },
            });
            if (updated.count === 0) {
                throw new customError_1.default(400, `Insufficient stock for ${item.productName}`);
            }
        }
    }
    // 2. Create the buyer-facing order. `orderStatus` is the derived rollup of
    //    the slices we are about to create.
    const order = await tx.order.create({
        data: {
            orderNumber: input.orderNumber,
            userId: input.userId,
            subtotal: calculation.subtotal,
            tax: calculation.tax,
            shippingCost: calculation.shippingCost,
            discount: calculation.discount,
            totalAmount: calculation.totalAmount,
            paymentMethod: input.paymentMethod,
            paymentStatus: input.paymentStatus,
            orderStatus: (0, order_2.deriveOrderStatus)(calculation.vendors.map(() => input.initialVendorStatus)),
            shippingAddressId: input.shippingAddressId,
            shippingSnapshot: shippingAddress,
            ipAddress: input.ipAddress ?? undefined,
            userAgent: input.userAgent ?? undefined,
            notes: input.notes ?? undefined,
        },
    });
    // 3. One VendorOrder per store, with its items. The commission rate is
    //    snapshotted from the calculation so a later rate change to the store
    //    never rewrites this order's split.
    for (const [index, vendor] of calculation.vendors.entries()) {
        const vendorOrder = await tx.vendorOrder.create({
            data: {
                orderId: order.id,
                vendorId: vendor.vendorId,
                vendorOrderNumber: (0, order_1.buildVendorOrderNumber)(input.orderNumber, index),
                subtotal: vendor.subtotal,
                tax: vendor.tax,
                shippingCost: vendor.shippingCost,
                discount: vendor.discount,
                totalAmount: vendor.totalAmount,
                commissionRate: vendor.commissionRate,
                commissionAmount: vendor.commissionAmount,
                vendorEarning: vendor.vendorEarning,
                orderStatus: input.initialVendorStatus,
                items: {
                    create: vendor.items.map((item) => ({
                        orderId: order.id,
                        vendorId: vendor.vendorId,
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
        await (0, order_1.logStatusChange)(tx, {
            orderId: order.id,
            vendorOrderId: vendorOrder.id,
            oldStatus: prisma_1.OrderStatus.PENDING,
            newStatus: input.initialVendorStatus,
            userId: input.userId,
            note: input.initialVendorStatus === prisma_1.OrderStatus.PENDING
                ? "Order placed"
                : "Order placed — payment confirmed",
            ipAddress: input.ipAddress ?? undefined,
        });
    }
    // 4. One payment row for the whole order — the buyer is charged once, and
    //    the split lives on the vendor orders.
    await tx.payment.create({
        data: {
            orderId: order.id,
            amount: calculation.totalAmount,
            method: input.paymentMethod,
            status: input.paymentStatus,
            transactionId: input.transactionId,
            paymentGateway: input.paymentGateway,
            gatewayResponse: input.gatewayResponse,
            paidAt: input.paidAt,
        },
    });
    return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
            vendorOrders: {
                include: {
                    vendor: {
                        select: { id: true, storeName: true, slug: true, logo: true },
                    },
                    items: true,
                },
            },
            payment: true,
            shippingAddress: true,
            user: {
                select: {
                    id: true,
                    name: true,
                    auth: { select: { email: true } },
                },
            },
        },
    });
}
