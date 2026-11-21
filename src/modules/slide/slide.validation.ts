import z from "zod";

/**
 * The Cloudinary temp-folder handshake, as for `Category.image`: the client
 * uploads straight to Cloudinary and sends both halves, so the service can
 * promote the asset out of `temp/` on save. An image hosted elsewhere (the
 * seeded Unsplash banners) arrives with an empty `publicId`.
 */
const photoSchema = z.object({
    url: z.url({ error: "Photo must be a valid URL" }).trim(),
    publicId: z.string().trim(),
});

export const slideSchema = z.object({
    title: z
        .string({ error: "Title is required" })
        .min(5, "Title should contain at least 5 characters")
        .max(30, "Title should contain at most 30 characters")
        .trim(),
    subtitle: z
        .string({ error: "Subtitle is required" })
        .min(20, "Subtitle should contain at least 20 characters")
        .max(120, "Subtitle should contain at most 120 characters")
        .trim(),
    /** Replaces the old bare `photoUrl` string, which had no publicId to promote. */
    photo: photoSchema,
    /** Where the slide's button goes — a storefront path or a full URL. */
    url: z
        .string({ error: "URL link is required!" })
        .trim()
        .nonempty({ error: "URL link is required!" })
        .refine((value) => value.startsWith("/") || /^https?:\/\//.test(value), {
            error: "Link must be a path starting with / or a full http(s) URL",
        }),
    /** Display order, ascending — the storefront and admin lists sort by it. */
    sortOrder: z.number().int().min(0, "Sort order cannot be negative").optional(),
    /** `false` hides the slide from the storefront without deleting it. */
    isActive: z.boolean().optional(),
});

/**
 * PATCH /slides/:id — every field optional, nothing outside the list.
 *
 * The route had no `validateRequest` at all and the service passed `req.body`
 * straight into `prisma.slide.update`, so `isDeleted`, `id` and `createdAt`
 * were settable — the hole BE-21 and the category module already closed.
 */
export const slideUpdateSchema = slideSchema.partial();

export type TSlide = z.infer<typeof slideSchema>;
export type TSlideUpdate = z.infer<typeof slideUpdateSchema>;
