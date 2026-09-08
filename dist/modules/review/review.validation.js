"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewValidation = void 0;
const zod_1 = __importDefault(require("zod"));
const createReview = zod_1.default.object({
    rating: zod_1.default.number().min(1, "Min value is 1").max(5, "Max value is 5"),
    comment: zod_1.default
        .string()
        .min(5, "Min length is 2")
        .max(400, "Max length is 400")
        .trim()
        .optional(),
    productId: zod_1.default.string({ error: "Product ID is required" }),
});
const updateReview = zod_1.default.object({
    rating: zod_1.default
        .number()
        .min(1, "Min value is 1")
        .max(5, "Max value is 5")
        .optional(),
    comment: zod_1.default
        .string()
        .min(2, "Min length is 2")
        .max(400, "Max length is 400")
        .optional(),
});
exports.reviewValidation = { createReview, updateReview };
