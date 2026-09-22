import { z } from "zod";
import { decimalSchema } from "@/utils/utils";
import { GenderEnum } from "@/helpers/enum";

export const productImageSchema = z.object({
	id: z.string().optional(),
	url: z.url({ error: "URL is required" }),
	publicId: z.string({ error: "Public ID is required" }),
	altText: z.string().optional(),
	isMain: z.boolean().optional(),
});

export const productVariantSchema = z.object({
	id: z.string().optional(),
	sizeId: z.string(),
	color: z.string(),
	stock: z.number().min(0),
	price: decimalSchema,
});

/**
 * Note what is NOT accepted from the client: `status`, `rejectionReason`,
 * `approvedAt` and `slug`. Moderation state is set by the moderation endpoints
 * and the slug is derived — accepting them here would let a vendor
 * self-approve a listing.
 *
 * `vendorId` is accepted but only honoured for an ADMIN creating on a store's
 * behalf; a VENDOR's own store id always wins (see resolveVendorScope).
 */
export const productSchema = z.object({
	name: z.string({ error: "Product name is required" }).min(2),
	description: z.string().min(30, "Description min length is 30"),
	basePrice: decimalSchema,
	discountPrice: decimalSchema.optional(),
	stockQuantity: z.number().min(0),
	gender: GenderEnum,
	// Required, unlike the shared `uuidSchema` which is nullish — both are
	// NOT NULL columns and a product with neither cannot be listed.
	categoryId: z.uuid({ version: "v4", error: "Category is required" }),
	brandId: z.uuid({ version: "v4", error: "Brand is required" }),
	vendorId: z.uuid({ version: "v4" }).optional(),
	isPublished: z.boolean().optional(),
	isFeatured: z.boolean().optional(),
	/** Submit for review straight away instead of saving as a draft. */
	submitForReview: z.boolean().optional(),
	variants: z.array(productVariantSchema).optional(),
	images: z.array(productImageSchema).min(1, "One image is required"),
});

export const updateProductSchema = productSchema.partial().omit({
	vendorId: true,
});

export const rejectProductSchema = z.object({
	reason: z
		.string({ error: "A reason is required so the vendor can fix it" })
		.trim()
		.min(10, "Give a reason of at least 10 characters")
		.max(500),
});

export const publishProductSchema = z.object({
	isPublished: z.boolean({ error: "isPublished is required" }),
});

export type TProductCreate = z.infer<typeof productSchema>;
export type TProductUpdate = z.infer<typeof updateProductSchema>;
export type TRejectProduct = z.infer<typeof rejectProductSchema>;

export const productValidation = {
	productSchema,
	updateProductSchema,
	rejectProductSchema,
	publishProductSchema,
};
