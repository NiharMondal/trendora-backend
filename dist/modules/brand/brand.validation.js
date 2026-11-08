"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.brandUpdateSchema = exports.brandSchema = void 0;
const zod_1 = require("zod");
/**
 * `Brand.logo` is a plain URL string — unlike `Vendor.logo`, which is the
 * `{ url, publicId }` Cloudinary handshake payload.
 *
 * The admin brand form initialises `logo: ""` and submits its values verbatim,
 * so an empty string has to mean "no logo" rather than 400 or land in the
 * column as `""`. It maps to `null`, which is also how an existing logo is
 * cleared on update.
 */
const logoSchema = zod_1.z.preprocess((value) => (typeof value === "string" ? value.trim() || null : value), zod_1.z.url({ error: "Brand logo must be a valid URL" }).nullish());
const nameSchema = zod_1.z
    .string({ error: "Brand name is required" })
    .min(2, "Brand must be at least 2 characters long")
    .trim();
exports.brandSchema = zod_1.z.object({
    name: nameSchema,
    logo: logoSchema,
});
/** PATCH /brands/:id — every field optional, but no field outside this list. */
exports.brandUpdateSchema = zod_1.z.object({
    name: nameSchema.optional(),
    logo: logoSchema,
});
