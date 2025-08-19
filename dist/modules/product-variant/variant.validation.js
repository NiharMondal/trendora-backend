"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.variantValidation = void 0;
const zod_1 = __importDefault(require("zod"));
const createVariant = zod_1.default.object({
    productId: zod_1.default
        .string({ error: "Product ID is required" })
        .nonempty("Product ID can not be empty")
        .trim(),
    size: zod_1.default.string({ error: "Variant size is required" }).trim(),
    color: zod_1.default.string({ error: "Variant color is required" }).trim(),
    stock: zod_1.default.number({ error: "Variant stock is required" }).positive(),
    price: zod_1.default.number({ error: "Variant price is required" }).positive(),
});
const addVariants = zod_1.default
    .array(createVariant)
    .min(1, "At least 1 variant is required");
const updateVariant = createVariant.partial();
exports.variantValidation = { createVariant, updateVariant, addVariants };
