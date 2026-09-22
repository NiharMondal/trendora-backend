"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCODOrder = createCODOrder;
const prisma_client_1 = require("../lib/prisma-client.js");
const db_1 = require("../config/db.js");
const create_order_1 = require("./create-order");
const notifications_1 = require("./notifications");
/**
 * Cash on delivery: the order is created inline, unpaid. Payment flips to PAID
 * when the last vendor order is delivered (see the order service).
 */
async function createCODOrder(input) {
    const order = await db_1.prisma.$transaction(async (tx) => (0, create_order_1.persistOrder)(tx, {
        orderNumber: input.orderNumber,
        userId: input.userId,
        shippingAddressId: input.shippingAddressId,
        calculation: input.calculation,
        paymentMethod: prisma_client_1.PaymentMethod.CASH_ON_DELIVERY,
        paymentStatus: prisma_client_1.PaymentStatus.PENDING,
        initialVendorStatus: prisma_client_1.OrderStatus.PENDING,
        notes: input.notes,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
    }));
    // AFTER the commit, never inside it — this reads and talks to SMTP, and it
    // must not be able to fail an order that already exists.
    await (0, notifications_1.notifyOrderPlaced)(order.id);
    return order;
}
