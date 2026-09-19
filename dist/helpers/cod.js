"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCODOrder = createCODOrder;
const prisma_1 = require("../../generated/prisma");
const db_1 = require("../config/db");
const create_order_1 = require("./create-order");
/**
 * Cash on delivery: the order is created inline, unpaid. Payment flips to PAID
 * when the last vendor order is delivered (see the order service).
 */
async function createCODOrder(input) {
    return db_1.prisma.$transaction(async (tx) => (0, create_order_1.persistOrder)(tx, {
        orderNumber: input.orderNumber,
        userId: input.userId,
        shippingAddressId: input.shippingAddressId,
        calculation: input.calculation,
        paymentMethod: prisma_1.PaymentMethod.CASH_ON_DELIVERY,
        paymentStatus: prisma_1.PaymentStatus.PENDING,
        initialVendorStatus: prisma_1.OrderStatus.PENDING,
        notes: input.notes,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
    }));
}
