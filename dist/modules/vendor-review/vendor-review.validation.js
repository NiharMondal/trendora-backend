"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorReviewValidation = void 0;
const zod_1 = require("zod");
/**
 * A store rating is tied to a delivered vendor order, which is what makes it a
 * verified review: `vendorId` is derived from that order rather than trusted
 * from the client.
 */
const createVendorReviewSchema = zod_1.z.object({
    vendorOrderId: zod_1.z.uuid({
        version: "v4",
        error: "vendorOrderId is required",
    }),
    rating: zod_1.z
        .number({ error: "Rating is required" })
        .min(1, "Min value is 1")
        .max(5, "Max value is 5"),
    comment: zod_1.z.string().trim().min(5).max(400).optional(),
});
const updateVendorReviewSchema = zod_1.z.object({
    rating: zod_1.z.number().min(1, "Min value is 1").max(5, "Max value is 5").optional(),
    comment: zod_1.z.string().trim().min(5).max(400).optional(),
});
exports.vendorReviewValidation = {
    createVendorReviewSchema,
    updateVendorReviewSchema,
};
