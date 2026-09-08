import { z } from "zod";

/**
 * Record money returned outside the gateway — cash handed back on a COD
 * order, or a bank transfer done by hand. This does NOT call Stripe; it
 * records that the money has already moved.
 */
const manualRefundSchema = z.object({
    orderId: z.uuid({ version: "v4", error: "orderId is required" }),
    /** Optional: ties the refund to one parcel, at most one per parcel. */
    vendorOrderId: z.uuid({ version: "v4" }).optional(),
    amount: z.coerce
        .number({ error: "Amount is required" })
        .positive("Amount must be greater than 0")
        .refine((value) => Number(value.toFixed(2)) === value, {
            message: "Must have at most 2 decimal places",
        }),
    reason: z
        .string({ error: "A reason is required" })
        .trim()
        .min(5, "Give a reason of at least 5 characters")
        .max(500),
    /** How the money went back: "cash", "bank_transfer", … */
    method: z.string().trim().max(40).optional(),
});

const cancelRefundSchema = z.object({
    reason: z
        .string({ error: "A reason is required" })
        .trim()
        .min(5, "Give a reason of at least 5 characters")
        .max(500),
});

export type TManualRefund = z.infer<typeof manualRefundSchema>;
export type TCancelRefund = z.infer<typeof cancelRefundSchema>;

export const refundValidation = { manualRefundSchema, cancelRefundSchema };
