"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refundValidation = void 0;
const zod_1 = require("zod");
/**
 * Record money returned outside the gateway — cash handed back on a COD
 * order, or a bank transfer done by hand. This does NOT call Stripe; it
 * records that the money has already moved.
 */
const manualRefundSchema = zod_1.z.object({
    orderId: zod_1.z.uuid({ version: "v4", error: "orderId is required" }),
    /** Optional: ties the refund to one parcel, at most one per parcel. */
    vendorOrderId: zod_1.z.uuid({ version: "v4" }).optional(),
    amount: zod_1.z.coerce
        .number({ error: "Amount is required" })
        .positive("Amount must be greater than 0")
        .refine((value) => Number(value.toFixed(2)) === value, {
        message: "Must have at most 2 decimal places",
    }),
    reason: zod_1.z
        .string({ error: "A reason is required" })
        .trim()
        .min(5, "Give a reason of at least 5 characters")
        .max(500),
    /** How the money went back: "cash", "bank_transfer", … */
    method: zod_1.z.string().trim().max(40).optional(),
});
const cancelRefundSchema = zod_1.z.object({
    reason: zod_1.z
        .string({ error: "A reason is required" })
        .trim()
        .min(5, "Give a reason of at least 5 characters")
        .max(500),
});
exports.refundValidation = { manualRefundSchema, cancelRefundSchema };
