import z from "zod";

export const slideSchema = z.object({
    title: z
        .string()
        .min(5, "Title should contain at least 5 characters")
        .max(30, "Title should contain at least 30 characters")
        .trim(),
    subtitle: z
        .string()
        .min(20, "Subtitle should contain at least 20 characters")
        .trim(),
    photoUrl: z
        .string({ error: "Photo url is required!" })
        .nonempty({ error: "Photo url is required!" }),
    url: z
        .string({ error: "URL link is required!" })
        .nonempty({ error: "URL link is required!" }),
});
