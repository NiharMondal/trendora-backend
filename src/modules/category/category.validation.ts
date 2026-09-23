import { z } from "zod";

/**
 * The Cloudinary temp-folder handshake: the client uploads straight to
 * Cloudinary and sends us both halves, so the service can promote the asset
 * out of `temp/` on save and destroy the one it replaces.
 */
const imageSchema = z.object({
	url: z.string().trim(),
	publicId: z.string().trim(),
});

export const categorySchema = z.object({
	name: z
		.string("Category name is required")
		.nonempty("Category name is required")
		.min(2, "Category must be at least 2 characters long")
		.trim(),
	parentId: z.string().nullish().nullable(),
	sizeGroupId: z.string().nullish().nullable(),
	/**
	 * Sales tax for this category, as a fraction: 0.18 is 18%.
	 *
	 * Nullable on purpose, and `null` is not the same as `0` — null means "use
	 * the platform rate" (`TAX_RATE`), while 0 means genuinely zero-rated.
	 * Capped at 4 decimal places to match `Decimal(5, 4)`, so a value the
	 * column would silently truncate is a 400 instead.
	 */
	taxRate: z
		.number()
		.min(0, "Tax rate cannot be negative")
		.max(1, "Tax rate is a fraction: 0.18 means 18%")
		.refine((value) => Number(value.toFixed(4)) === value, {
			error: "Tax rate supports at most 4 decimal places",
		})
		.nullish(),
	/**
	 * Merchandising artwork for the storefront's category tiles. `null`
	 * clears it — which is why this is nullable rather than merely optional:
	 * an admin has to be able to take a picture back off a category, and
	 * `undefined` on a PATCH means "leave it alone".
	 */
	image: imageSchema.nullish(),
});

/**
 * PATCH /categories/:id — every field optional, nothing outside the list.
 *
 * The route had no `validateRequest` at all and the service passed `req.body`
 * straight into `prisma.category.update`, so `isDeleted`, `id` and `createdAt`
 * were all settable (the same hole BE-21 closed on Brand). That matters more
 * now: `taxRate` is money, and this is the route an admin uses to set it.
 */
export const categoryUpdateSchema = categorySchema.partial();

export type TCategory = z.infer<typeof categorySchema>;
export type TCategoryUpdate = z.infer<typeof categoryUpdateSchema>;

export const categoryValidation = { categorySchema, categoryUpdateSchema };
