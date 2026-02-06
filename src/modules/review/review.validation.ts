import z from "zod";

const createReview = z.object({
    rating: z.number().min(1, "Min value is 1").max(5, "Max value is 5"),
    comment: z
        .string()
        .min(2, "Min length is 2")
        .max(400, "Max length is 400")
        .optional(),
    userId: z.string({ error: "User ID is required" }),
    productId: z.string({ error: "Product ID is required" }),
});
const updateReview = z.object({
    rating: z
        .number()
        .min(1, "Min value is 1")
        .max(5, "Max value is 5")
        .optional(),
    comment: z
        .string()
        .min(2, "Min length is 2")
        .max(400, "Max length is 400")
        .optional(),
});

export const reviewValidation = { createReview, updateReview };
