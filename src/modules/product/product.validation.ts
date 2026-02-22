import { z } from "zod";
import { decimalSchema, uuidSchema } from "../../utils/utils";

export const productImageSchema = z.object({
	url: z.url({ error: "URL is required" }),
	publicId: z.string({ error: "Public ID is required" }),
	altText: z.string().optional(),
	isMain: z.boolean().optional(),
});

export const productVariantSchema = z.object({
	sizeId: z.string(),
	color: z.string(),
	stock: z.number().min(0),
	price: decimalSchema,
});

export const productSchema = z.object({
	name: z.string({ error: "Product name is required" }).min(2),
	description: z.string().min(30, "Description min length is 30"),
	basePrice: decimalSchema,
	discountPrice: decimalSchema.optional(),
	stockQuantity: z.number().min(0),
	gender: z
		.string({ error: "Gender is required" })
		.nonempty({ error: "Gender is required" })
		.trim(),
	categoryId: uuidSchema,
	brandId: uuidSchema,
	isPublished: z.boolean().optional(),
	isFeatured: z.boolean().optional(),
	variants: z.array(productVariantSchema).optional(),
	images: z.array(productImageSchema).min(1, "One image is required"),
});
