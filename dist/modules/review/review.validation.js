"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewValidation = void 0;
const zod_1 = __importDefault(require("zod"));
/**
 * An empty comment means "rating only", not "a comment that is too short".
 * The form always sends `comment: ""`, and `.optional()` does not apply to a
 * present empty string, so every rating-only review used to 400 — with a
 * message ("Min length is 2") that did not even match the rule (XR-04).
 */
const optionalComment = zod_1.default.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), zod_1.default
    .string()
    .trim()
    .min(2, "A comment should be at least 2 characters")
    .max(400, "A comment should be at most 400 characters")
    .optional());
const createReview = zod_1.default.object({
    rating: zod_1.default.number().min(1, "Min value is 1").max(5, "Max value is 5"),
    comment: optionalComment,
    productId: zod_1.default.string({ error: "Product ID is required" }),
});
const updateReview = zod_1.default.object({
    rating: zod_1.default
        .number()
        .min(1, "Min value is 1")
        .max(5, "Max value is 5")
        .optional(),
    comment: optionalComment,
});
exports.reviewValidation = { createReview, updateReview };
