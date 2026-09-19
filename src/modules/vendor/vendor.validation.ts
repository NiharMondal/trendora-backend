import { z } from "zod";

/** Cloudinary temp-folder handshake payload (see utils/cloudinary.ts). */
const imageSchema = z.object({
    url: z.url({ error: "Image URL is required" }),
    publicId: z.string({ error: "Image publicId is required" }).nonempty(),
});

const moneySchema = z
    .number()
    .min(0, "Cannot be negative")
    .refine((value) => Number(value.toFixed(2)) === value, {
        message: "Must have at most 2 decimal places",
    });

/**
 * What a shopper-turned-seller submits. Deliberately does NOT accept
 * `status`, `commissionRate` or `slug` — approval and the platform's cut are
 * admin decisions, and the slug is derived from the store name.
 */
const applySchema = z.object({
    storeName: z
        .string({ error: "Store name is required" })
        .trim()
        .min(3, "Store name must be at least 3 characters")
        .max(60, "Store name must be at most 60 characters"),
    description: z
        .string()
        .trim()
        .min(30, "Tell shoppers about your store in at least 30 characters")
        .max(1000)
        .optional(),
    businessEmail: z.email({ error: "A valid business email is required" }),
    businessPhone: z
        .string({ error: "Business phone is required" })
        .trim()
        .min(6, "Business phone looks too short"),
    taxId: z.string().trim().max(60).optional(),
    logo: imageSchema.optional(),
    banner: imageSchema.optional(),
    /** Bank / wallet details. Stored as-is; never returned publicly. */
    payoutDetails: z.record(z.string(), z.unknown()).optional(),
});

/** What a vendor may change about their own store. */
const updateMyStoreSchema = z.object({
    storeName: z.string().trim().min(3).max(60).optional(),
    description: z.string().trim().min(30).max(1000).optional(),
    businessEmail: z.email().optional(),
    businessPhone: z.string().trim().min(6).optional(),
    taxId: z.string().trim().max(60).optional(),
    logo: imageSchema.optional(),
    banner: imageSchema.optional(),
    payoutDetails: z.record(z.string(), z.unknown()).optional(),
    // A vendor sets their own delivery pricing.
    shippingFee: moneySchema.optional(),
    freeShippingThreshold: moneySchema.optional(),
});

/** Admin-only knobs. commissionRate lives here and nowhere else. */
const updateVendorSettingsSchema = z.object({
    commissionRate: z
        .number()
        .min(0, "Commission cannot be negative")
        .max(1, "Commission is a fraction, e.g. 0.1 for 10%")
        .optional(),
    shippingFee: moneySchema.optional(),
    freeShippingThreshold: moneySchema.optional(),
});

const rejectVendorSchema = z.object({
    reason: z
        .string({ error: "A reason is required so the seller can fix it" })
        .trim()
        .min(10, "Give a reason of at least 10 characters")
        .max(500),
});

const suspendVendorSchema = z.object({
    reason: z
        .string({ error: "A reason is required" })
        .trim()
        .min(10, "Give a reason of at least 10 characters")
        .max(500),
});

export type TVendorApply = z.infer<typeof applySchema>;
export type TUpdateMyStore = z.infer<typeof updateMyStoreSchema>;
export type TUpdateVendorSettings = z.infer<typeof updateVendorSettingsSchema>;
export type TRejectVendor = z.infer<typeof rejectVendorSchema>;
export type TSuspendVendor = z.infer<typeof suspendVendorSchema>;

export const vendorValidation = {
    applySchema,
    updateMyStoreSchema,
    updateVendorSettingsSchema,
    rejectVendorSchema,
    suspendVendorSchema,
};
