"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageValidation = exports.updateImageSchema = exports.addImagesSchema = void 0;
const zod_1 = require("zod");
/**
 * A freshly uploaded asset, straight from the Cloudinary temp-folder handshake.
 *
 * No `id` here on purpose: this schema is only ever used to ADD images. An
 * existing image is edited through `PATCH .../images/:imageId`, so a client
 * cannot accidentally address one by putting an id in a create payload.
 */
const newImage = zod_1.z.object({
    url: zod_1.z.url({ error: "Image URL is required" }),
    publicId: zod_1.z
        .string({ error: "Image publicId is required" })
        .nonempty("Image publicId is required"),
    altText: zod_1.z.string().trim().max(200).optional(),
    isMain: zod_1.z.boolean().optional(),
});
/** POST /products/:productId/images — one call adds one or many. */
exports.addImagesSchema = zod_1.z.object({
    images: zod_1.z
        .array(newImage)
        .min(1, "At least one image is required")
        .max(20, "Add at most 20 images at a time"),
});
/**
 * PATCH /products/:productId/images/:imageId.
 *
 * Only presentation: which image is the hero and what the alt text says. The
 * picture itself is never swapped in place — replacing imagery is an add plus a
 * delete, so the Cloudinary asset it points at always matches the row.
 */
exports.updateImageSchema = zod_1.z
    .object({
    altText: zod_1.z.string().trim().max(200).nullish(),
    isMain: zod_1.z.boolean().optional(),
})
    .refine((body) => Object.keys(body).length > 0, {
    error: "Provide at least one field to update",
});
exports.imageValidation = { addImagesSchema: exports.addImagesSchema, updateImageSchema: exports.updateImageSchema };
