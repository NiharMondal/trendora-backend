import { z } from "zod";

import { decimalSchema } from "@/utils/utils";

/**
 * One size/colour line of a product.
 *
 * `sizeId` is nullish because the column is (`ProductVariant.sizeId String?`) —
 * a colour-only variant is legitimate for something that does not come in
 * sizes. `stock` allows 0: sold out is a normal state, and the previous schema
 * here used `.positive()`, which made it impossible to set.
 */
const variantBody = z.object({
    sizeId: z.uuid({ version: "v4" }).nullish(),
    color: z
        .string({ error: "Variant colour is required" })
        .trim()
        .min(1, "Variant colour is required"),
    stock: z
        .number({ error: "Variant stock is required" })
        .int("Stock must be a whole number")
        .min(0, "Stock cannot be negative"),
    price: decimalSchema,
});

/** POST /products/:productId/variants — one call adds one or many. */
export const addVariantsSchema = z.object({
    variants: z
        .array(variantBody)
        .min(1, "At least one variant is required")
        .max(100, "Add at most 100 variants at a time"),
});

/**
 * PATCH /products/:productId/variants/:variantId — every field optional, but
 * an empty body is a no-op reported as success, so require at least one.
 */
export const updateVariantSchema = variantBody
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
        error: "Provide at least one field to update",
    });

export type TAddVariants = z.infer<typeof addVariantsSchema>;
export type TUpdateVariant = z.infer<typeof updateVariantSchema>;

export const variantValidation = { addVariantsSchema, updateVariantSchema };
