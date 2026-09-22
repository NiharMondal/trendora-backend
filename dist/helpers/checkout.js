"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expireStaleCheckoutSessions = exports.consumeCheckoutSession = exports.attachStripeSession = exports.createCheckoutSession = void 0;
const prisma_client_1 = require("../lib/prisma-client.js");
const db_1 = require("../config/db.js");
const env_config_1 = require("../config/env-config.js");
const customError_1 = __importDefault(require("../utils/customError.js"));
const createCheckoutSession = async (input) => {
    const expiresAt = new Date(Date.now() + env_config_1.envConfig.checkout_session_ttl_minutes * 60 * 1000);
    return db_1.prisma.checkoutSession.create({
        data: {
            orderNumber: input.orderNumber,
            userId: input.userId,
            shippingAddressId: input.shippingAddressId,
            paymentMethod: input.paymentMethod,
            calculation: input.calculation,
            amountTotal: input.calculation.totalAmount,
            notes: input.notes,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            expiresAt,
        },
    });
};
exports.createCheckoutSession = createCheckoutSession;
const attachStripeSession = async (checkoutSessionId, stripeSessionId) => db_1.prisma.checkoutSession.update({
    where: { id: checkoutSessionId },
    data: { stripeSessionId },
});
exports.attachStripeSession = attachStripeSession;
/**
 * Claim a draft for order creation.
 *
 * Must run inside the same transaction as the order insert. The update is
 * conditional on `status = PENDING`, so two concurrent webhook deliveries
 * cannot both redeem it — the loser sees 0 rows updated and is told the draft
 * is already consumed.
 */
const consumeCheckoutSession = async (tx, checkoutSessionId) => {
    const draft = await tx.checkoutSession.findUnique({
        where: { id: checkoutSessionId },
    });
    if (!draft) {
        throw new customError_1.default(404, "Checkout session not found");
    }
    if (draft.status !== prisma_client_1.CheckoutSessionStatus.PENDING) {
        throw new customError_1.default(409, `Checkout session already ${draft.status.toLowerCase()}`);
    }
    const claimed = await tx.checkoutSession.updateMany({
        where: { id: checkoutSessionId, status: prisma_client_1.CheckoutSessionStatus.PENDING },
        data: {
            status: prisma_client_1.CheckoutSessionStatus.COMPLETED,
            consumedAt: new Date(),
        },
    });
    if (claimed.count === 0) {
        throw new customError_1.default(409, "Checkout session already consumed");
    }
    return {
        calculation: draft.calculation,
        orderNumber: draft.orderNumber,
        userId: draft.userId,
        shippingAddressId: draft.shippingAddressId,
        notes: draft.notes,
        ipAddress: draft.ipAddress,
        userAgent: draft.userAgent,
    };
};
exports.consumeCheckoutSession = consumeCheckoutSession;
/**
 * Sweep drafts whose TTL has passed. Scheduled hourly by
 * `src/scheduler/index.ts`; expired drafts are harmless either way, because
 * `consumeCheckoutSession` also refuses anything not PENDING.
 */
const expireStaleCheckoutSessions = async () => db_1.prisma.checkoutSession.updateMany({
    where: {
        status: prisma_client_1.CheckoutSessionStatus.PENDING,
        expiresAt: { lt: new Date() },
    },
    data: { status: prisma_client_1.CheckoutSessionStatus.EXPIRED },
});
exports.expireStaleCheckoutSessions = expireStaleCheckoutSessions;
