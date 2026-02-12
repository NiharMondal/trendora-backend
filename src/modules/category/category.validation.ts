import { z } from "zod";
import { uuidSchema } from "../../utils/utils";

export const categorySchema = z.object({
    name: z
        .string()
        .min(2, "Category must be at least 2 characters long")
        .trim(),
    parentId: uuidSchema.nullish().nullable(),
});
