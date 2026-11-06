"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productValidation = exports.publishProductSchema = exports.rejectProductSchema = exports.updateProductSchema = exports.productSchema = exports.productVariantSchema = exports.productImageSchema = void 0;
const zod_1 = require("zod");
const utils_1 = require("../../utils/utils.js");
const enum_1 = require("../../helpers/enum.js");
exports.productImageSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    url: zod_1.z.url({ error: "URL is required" }),
    publicId: zod_1.z.string({ error: "Public ID is required" }),
    altText: zod_1.z.string().optional(),
    isMain: zod_1.z.boolean().optional(),
});
exports.productVariantSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    sizeId: zod_1.z.string(),
    color: zod_1.z.string(),
    stock: zod_1.z.number().min(0),
    price: utils_1.decimalSchema,
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
exports.productSchema = zod_1.z.object({
    name: zod_1.z.string({ error: "Product name is required" }).min(2),
    description: zod_1.z.string().min(30, "Description min length is 30"),
    basePrice: utils_1.decimalSchema,
    discountPrice: utils_1.decimalSchema.optional(),
    stockQuantity: zod_1.z.number().min(0),
    gender: enum_1.GenderEnum,
    // Both are NOT NULL columns and a product with neither cannot be listed,
    // so neither is optional here.
    categoryId: zod_1.z.uuid({ version: "v4", error: "Category is required" }),
    brandId: zod_1.z.uuid({ version: "v4", error: "Brand is required" }),
    vendorId: zod_1.z.uuid({ version: "v4" }).optional(),
    isPublished: zod_1.z.boolean().optional(),
    isFeatured: zod_1.z.boolean().optional(),
    /** Submit for review straight away instead of saving as a draft. */
    submitForReview: zod_1.z.boolean().optional(),
    variants: zod_1.z.array(exports.productVariantSchema).optional(),
    images: zod_1.z.array(exports.productImageSchema).min(1, "One image is required"),
});
exports.updateProductSchema = exports.productSchema.partial().omit({
    vendorId: true,
});
exports.rejectProductSchema = zod_1.z.object({
    reason: zod_1.z
        .string({ error: "A reason is required so the vendor can fix it" })
        .trim()
        .min(10, "Give a reason of at least 10 characters")
        .max(500),
});
exports.publishProductSchema = zod_1.z.object({
    isPublished: zod_1.z.boolean({ error: "isPublished is required" }),
});
exports.productValidation = {
    productSchema: exports.productSchema,
    updateProductSchema: exports.updateProductSchema,
    rejectProductSchema: exports.rejectProductSchema,
    publishProductSchema: exports.publishProductSchema,
};
