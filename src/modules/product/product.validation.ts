import { z } from "zod";
import { decimalSchema, uuidSchema } from "../../utils/utils";

export const productImageSchema = z.object({
    url: z.url({ error: "URL is required" }),
    isMain: z.boolean().optional(),
});

export const productVariantSchema = z.object({
    size: z.string(),
    color: z.string(),
    stock: z.number().int().min(0),
    price: decimalSchema,
});

export const productSchema = z.object({
    name: z.string({ error: "Product name is required" }).min(2),
    // slug: z.string(), will be generated automatically
    description: z.string().min(30, "Description min length is 30"),
    basePrice: decimalSchema,
    discountPrice: decimalSchema.optional(),
    stockQuantity: z.number().int().min(0),
    categoryId: uuidSchema,
    isPublished: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    variants: z.array(productVariantSchema).optional(),
    images: z.array(productImageSchema).min(1, "One image is required"),
});
