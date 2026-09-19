import { z } from "zod";

/**
 * A store rating is tied to a delivered vendor order, which is what makes it a
 * verified review: `vendorId` is derived from that order rather than trusted
 * from the client.
 */
const createVendorReviewSchema = z.object({
    vendorOrderId: z.uuid({
        version: "v4",
        error: "vendorOrderId is required",
    }),
    rating: z
        .number({ error: "Rating is required" })
        .min(1, "Min value is 1")
        .max(5, "Max value is 5"),
    comment: z.string().trim().min(5).max(400).optional(),
});

const updateVendorReviewSchema = z.object({
    rating: z.number().min(1, "Min value is 1").max(5, "Max value is 5").optional(),
    comment: z.string().trim().min(5).max(400).optional(),
});

export type TCreateVendorReview = z.infer<typeof createVendorReviewSchema>;
export type TUpdateVendorReview = z.infer<typeof updateVendorReviewSchema>;

export const vendorReviewValidation = {
    createVendorReviewSchema,
    updateVendorReviewSchema,
};
