import { z } from "zod";

/**
 * Generate a payout run for one vendor over a settlement window.
 *
 * Which orders are included is decided by the server (delivered, paid, not yet
 * attached to a payout) — the client only picks the vendor and the window, so
 * a caller cannot hand-pick which earnings to settle.
 */
const generatePayoutSchema = z
    .object({
        vendorId: z.uuid({ version: "v4", error: "vendorId is required" }),
        periodStart: z.coerce.date({ error: "periodStart is required" }),
        periodEnd: z.coerce.date({ error: "periodEnd is required" }),
        method: z.string().trim().max(40).optional(),
        notes: z.string().trim().max(500).optional(),
    })
    .refine((data) => data.periodEnd > data.periodStart, {
        message: "periodEnd must be after periodStart",
        path: ["periodEnd"],
    });

/** Marks money as actually sent. `reference` is the bank/gateway receipt. */
const markPaidSchema = z.object({
    reference: z
        .string({ error: "A transfer reference is required" })
        .trim()
        .min(3)
        .max(120),
    method: z.string().trim().max(40).optional(),
    notes: z.string().trim().max(500).optional(),
});

const markFailedSchema = z.object({
    failureReason: z
        .string({ error: "A failure reason is required" })
        .trim()
        .min(5)
        .max(500),
});

export type TGeneratePayout = z.infer<typeof generatePayoutSchema>;
export type TMarkPayoutPaid = z.infer<typeof markPaidSchema>;
export type TMarkPayoutFailed = z.infer<typeof markFailedSchema>;

export const payoutValidation = {
    generatePayoutSchema,
    markPaidSchema,
    markFailedSchema,
};
