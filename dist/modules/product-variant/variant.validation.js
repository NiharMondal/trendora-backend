"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.variantValidation = exports.updateVariantSchema = exports.addVariantsSchema = void 0;
const zod_1 = require("zod");
const utils_1 = require("../../utils/utils.js");
/**
 * One size/colour line of a product.
 *
 * `sizeId` is nullish because the column is (`ProductVariant.sizeId String?`) —
 * a colour-only variant is legitimate for something that does not come in
 * sizes. `stock` allows 0: sold out is a normal state, and the previous schema
 * here used `.positive()`, which made it impossible to set.
 */
const variantBody = zod_1.z.object({
    sizeId: zod_1.z.uuid({ version: "v4" }).nullish(),
    color: zod_1.z
        .string({ error: "Variant colour is required" })
        .trim()
        .min(1, "Variant colour is required"),
    stock: zod_1.z
        .number({ error: "Variant stock is required" })
        .int("Stock must be a whole number")
        .min(0, "Stock cannot be negative"),
    price: utils_1.decimalSchema,
});
/** POST /products/:productId/variants — one call adds one or many. */
exports.addVariantsSchema = zod_1.z.object({
    variants: zod_1.z
        .array(variantBody)
        .min(1, "At least one variant is required")
        .max(100, "Add at most 100 variants at a time"),
});
/**
 * PATCH /products/:productId/variants/:variantId — every field optional, but
 * an empty body is a no-op reported as success, so require at least one.
 */
exports.updateVariantSchema = variantBody
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "Provide at least one field to update",
});
exports.variantValidation = { addVariantsSchema: exports.addVariantsSchema, updateVariantSchema: exports.updateVariantSchema };
