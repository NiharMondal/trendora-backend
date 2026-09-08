"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payoutValidation = void 0;
const zod_1 = require("zod");
/**
 * Generate a payout run for one vendor over a settlement window.
 *
 * Which orders are included is decided by the server (delivered, paid, not yet
 * attached to a payout) — the client only picks the vendor and the window, so
 * a caller cannot hand-pick which earnings to settle.
 */
const generatePayoutSchema = zod_1.z
    .object({
    vendorId: zod_1.z.uuid({ version: "v4", error: "vendorId is required" }),
    periodStart: zod_1.z.coerce.date({ error: "periodStart is required" }),
    periodEnd: zod_1.z.coerce.date({ error: "periodEnd is required" }),
    method: zod_1.z.string().trim().max(40).optional(),
    notes: zod_1.z.string().trim().max(500).optional(),
})
    .refine((data) => data.periodEnd > data.periodStart, {
    message: "periodEnd must be after periodStart",
    path: ["periodEnd"],
});
/** Marks money as actually sent. `reference` is the bank/gateway receipt. */
const markPaidSchema = zod_1.z.object({
    reference: zod_1.z
        .string({ error: "A transfer reference is required" })
        .trim()
        .min(3)
        .max(120),
    method: zod_1.z.string().trim().max(40).optional(),
    notes: zod_1.z.string().trim().max(500).optional(),
});
const markFailedSchema = zod_1.z.object({
    failureReason: zod_1.z
        .string({ error: "A failure reason is required" })
        .trim()
        .min(5)
        .max(500),
});
exports.payoutValidation = {
    generatePayoutSchema,
    markPaidSchema,
    markFailedSchema,
};
