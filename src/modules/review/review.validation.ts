import z from "zod";

/**
 * An empty comment means "rating only", not "a comment that is too short".
 * The form always sends `comment: ""`, and `.optional()` does not apply to a
 * present empty string, so every rating-only review used to 400 — with a
 * message ("Min length is 2") that did not even match the rule (XR-04).
 */
const optionalComment = z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
        .string()
        .trim()
        .min(2, "A comment should be at least 2 characters")
        .max(400, "A comment should be at most 400 characters")
        .optional(),
);

const createReview = z.object({
    rating: z.number().min(1, "Min value is 1").max(5, "Max value is 5"),
    comment: optionalComment,
    productId: z.string({ error: "Product ID is required" }),
});
const updateReview = z.object({
    rating: z
        .number()
        .min(1, "Min value is 1")
        .max(5, "Max value is 5")
        .optional(),
    comment: optionalComment,
});

export const reviewValidation = { createReview, updateReview };
