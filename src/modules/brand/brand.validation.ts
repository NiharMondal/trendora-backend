import { z } from "zod";

export const brandSchema = z.object({
    name: z
        .string({ error: "Brand name is required" })
        .min(2, "Brand must be at least 2 characters long")
        .trim(),
});
