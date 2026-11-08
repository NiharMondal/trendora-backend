import { z } from "zod";

/**
 * `Brand.logo` is a plain URL string — unlike `Vendor.logo`, which is the
 * `{ url, publicId }` Cloudinary handshake payload.
 *
 * The admin brand form initialises `logo: ""` and submits its values verbatim,
 * so an empty string has to mean "no logo" rather than 400 or land in the
 * column as `""`. It maps to `null`, which is also how an existing logo is
 * cleared on update.
 */
const logoSchema = z.preprocess(
    (value) => (typeof value === "string" ? value.trim() || null : value),
    z.url({ error: "Brand logo must be a valid URL" }).nullish(),
);

const nameSchema = z
    .string({ error: "Brand name is required" })
    .min(2, "Brand must be at least 2 characters long")
    .trim();

export const brandSchema = z.object({
    name: nameSchema,
    logo: logoSchema,
});

/** PATCH /brands/:id — every field optional, but no field outside this list. */
export const brandUpdateSchema = z.object({
    name: nameSchema.optional(),
    logo: logoSchema,
});

export type TBrandCreate = z.infer<typeof brandSchema>;
export type TBrandUpdate = z.infer<typeof brandUpdateSchema>;
