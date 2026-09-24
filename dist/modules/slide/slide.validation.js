"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.slideUpdateSchema = exports.slideSchema = void 0;
const zod_1 = __importDefault(require("zod"));
/**
 * The Cloudinary temp-folder handshake, as for `Category.image`: the client
 * uploads straight to Cloudinary and sends both halves, so the service can
 * promote the asset out of `temp/` on save. An image hosted elsewhere (the
 * seeded Unsplash banners) arrives with an empty `publicId`.
 */
const photoSchema = zod_1.default.object({
    url: zod_1.default.url({ error: "Photo must be a valid URL" }).trim(),
    publicId: zod_1.default.string().trim(),
});
exports.slideSchema = zod_1.default.object({
    title: zod_1.default
        .string({ error: "Title is required" })
        .min(5, "Title should contain at least 5 characters")
        .max(30, "Title should contain at most 30 characters")
        .trim(),
    subtitle: zod_1.default
        .string({ error: "Subtitle is required" })
        .min(20, "Subtitle should contain at least 20 characters")
        .max(120, "Subtitle should contain at most 120 characters")
        .trim(),
    /** Replaces the old bare `photoUrl` string, which had no publicId to promote. */
    photo: photoSchema,
    /** Where the slide's button goes — a storefront path or a full URL. */
    url: zod_1.default
        .string({ error: "URL link is required!" })
        .trim()
        .nonempty({ error: "URL link is required!" })
        .refine((value) => value.startsWith("/") || /^https?:\/\//.test(value), {
        error: "Link must be a path starting with / or a full http(s) URL",
    }),
    /** Display order, ascending — the storefront and admin lists sort by it. */
    sortOrder: zod_1.default.number().int().min(0, "Sort order cannot be negative").optional(),
    /** `false` hides the slide from the storefront without deleting it. */
    isActive: zod_1.default.boolean().optional(),
});
/**
 * PATCH /slides/:id — every field optional, nothing outside the list.
 *
 * The route had no `validateRequest` at all and the service passed `req.body`
 * straight into `prisma.slide.update`, so `isDeleted`, `id` and `createdAt`
 * were settable — the hole BE-21 and the category module already closed.
 */
exports.slideUpdateSchema = exports.slideSchema.partial();
