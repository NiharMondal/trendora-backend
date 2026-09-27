"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.allowedTransitions = void 0;
exports.ensureTransitionAllowed = ensureTransitionAllowed;
exports.ensureTransitionAllowedForRole = ensureTransitionAllowedForRole;
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
const vendorAllowedTransitions = {
    PENDING: [prisma_client_1.OrderStatus.PROCESSING, prisma_client_1.OrderStatus.CANCELED],
    PROCESSING: [prisma_client_1.OrderStatus.SHIPPED, prisma_client_1.OrderStatus.CANCELED],
    SHIPPED: [prisma_client_1.OrderStatus.DELIVERED],
    DELIVERED: [],
    CANCELED: [],
};
function ensureTransitionAllowed(current, next) {
    const nexts = exports.allowedTransitions[current] ?? [];
    if (!nexts.includes(next)) {
        throw new customError_1.default(400, `Invalid status transition: ${current} → ${next}`);
    }
}
/**
 * As above, but also enforces what the caller's role is permitted to do.
 * ADMIN may perform any transition the state machine allows.
 */
function ensureTransitionAllowedForRole(current, next, role) {
    ensureTransitionAllowed(current, next);
    if (role === prisma_client_1.Role.ADMIN)
        return;
    const nexts = vendorAllowedTransitions[current] ?? [];
    if (!nexts.includes(next)) {
        throw new customError_1.default(403, `A vendor cannot change an order from ${current} to ${next}. Contact support.`);
    }
}
