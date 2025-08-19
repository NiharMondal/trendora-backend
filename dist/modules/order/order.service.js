"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderServices = void 0;
const db_1 = require("../../config/db");
const customError_1 = __importDefault(require("../../utils/customError"));
const createOrder = async (payload) => {
    const { items, ...rest } = payload;
    return await db_1.prisma.$transaction(async (tx) => {
        // checking product or variant stock
        for (const item of items) {
            if (item.variantId) {
                const variant = await tx.productVariant.findUnique({
                    where: { id: item.variantId },
                });
                if (!variant || variant.stock < item.quantity) {
                    throw new customError_1.default(400, `Insufficient stock for this variant`);
                }
                await tx.productVariant.update({
                    where: { id: item.variantId },
                    data: { stock: { decrement: item.quantity } },
                });
            }
            else {
                const product = await tx.product.findUnique({
                    where: { id: item.productId },
                });
                if (!product || product.stockQuantity < item.quantity) {
                    throw new customError_1.default(400, `Insufficient stock for this product`);
                }
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stockQuantity: { decrement: item.quantity } },
                });
            }
        }
        // count total price
        const totalAmount = items.reduce((acc, item) => acc + Number(item.price) * item.quantity, 0);
        const order = await tx.order.create({
            data: {
                ...rest,
                totalAmount,
                items: {
                    create: items,
                },
            },
            include: { items: true },
        });
        const payment = await tx.payment.create({
            data: {
                orderId: order.id,
                amount: totalAmount,
                method: rest.paymentMethod,
            },
        });
        // STRIPE
        return { order, payment };
    });
};
exports.orderServices = { createOrder };
