"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.allowedTransitions = void 0;
exports.ensureTransitionAllowed = ensureTransitionAllowed;
exports.ensureTransitionAllowedForActor = ensureTransitionAllowedForActor;
const prisma_client_1 = require("../lib/prisma-client.js");
const customError_1 = __importDefault(require("../utils/customError.js"));
/**
 * The fulfilment state machine. Applies to a VendorOrder — the parent Order's
 * status is derived from its slices (see deriveOrderStatus in ./order.ts) and
 * is never transitioned directly.
 */
exports.allowedTransitions = {
    PENDING: [prisma_client_1.OrderStatus.PROCESSING, prisma_client_1.OrderStatus.CANCELED],
    PROCESSING: [prisma_client_1.OrderStatus.SHIPPED, prisma_client_1.OrderStatus.CANCELED],
    SHIPPED: [prisma_client_1.OrderStatus.DELIVERED, prisma_client_1.OrderStatus.CANCELED],
    DELIVERED: [],
    CANCELED: [],
};
/**
 * Transitions a VENDOR may perform on their own order.
 *
 * A vendor moves an order forward and may cancel while nothing has shipped.
 * Cancelling an already-shipped order is a refund dispute, so it is reserved
 * for an ADMIN — otherwise a vendor could cancel (and trigger a refund) on
 * goods the buyer has already received.
 */
const sellerAllowedTransitions = {
    PENDING: [prisma_client_1.OrderStatus.PROCESSING, prisma_client_1.OrderStatus.CANCELED],
    PROCESSING: [prisma_client_1.OrderStatus.SHIPPED, prisma_client_1.OrderStatus.CANCELED],
    SHIPPED: [prisma_client_1.OrderStatus.DELIVERED],
    DELIVERED: [],
    CANCELED: [],
};
/**
 * Transitions the BUYER may perform on a parcel of their own order.
 *
 * Cancel while the parcel is still PENDING, and nothing else. Once the seller
 * has accepted it and moved to PROCESSING they are packing real goods, so
 * calling it off stops being a unilateral decision and becomes a request —
 * the seller or an admin cancels it then.
 *
 * **The gate is the ORDER status, never the payment status.** A cash-on-delivery
 * order stays `paymentStatus: PENDING` right up until every parcel is delivered
 * (see `reconcilePayment`), so "payment is still pending" would let a buyer
 * cancel a COD parcel that has already shipped. Payment status decides what
 * *happens* on cancel — whether a refund is owed — not whether cancel is
 * allowed; `recordRefundIntent` handles that part.
 */
const buyerAllowedTransitions = {
    PENDING: [prisma_client_1.OrderStatus.CANCELED],
    PROCESSING: [],
    SHIPPED: [],
    DELIVERED: [],
    CANCELED: [],
};
const transitionsByCapacity = {
    admin: exports.allowedTransitions,
    seller: sellerAllowedTransitions,
    buyer: buyerAllowedTransitions,
};
function ensureTransitionAllowed(current, next) {
    const nexts = exports.allowedTransitions[current] ?? [];
    if (!nexts.includes(next)) {
        throw new customError_1.default(400, `Invalid status transition: ${current} → ${next}`);
    }
}
/**
 * As above, but also enforces what the caller's **capacity** permits.
 * ADMIN may perform any transition the state machine allows.
 */
function ensureTransitionAllowedForActor(current, next, capacity) {
    ensureTransitionAllowed(current, next);
    if (capacity === "admin")
        return;
    const nexts = transitionsByCapacity[capacity][current] ?? [];
    if (!nexts.includes(next)) {
        if (capacity === "buyer") {
            // Be specific: "you cannot cancel now" is actionable, "forbidden"
            // is not. The buyer needs to know to contact the seller instead.
            throw new customError_1.default(403, next === prisma_client_1.OrderStatus.CANCELED
                ? `This order can no longer be cancelled because the seller has already moved it to ${current}. Contact the seller to request a cancellation.`
                : `You cannot change an order from ${current} to ${next}.`);
        }
        throw new customError_1.default(403, `A vendor cannot change an order from ${current} to ${next}. Contact support.`);
    }
}
