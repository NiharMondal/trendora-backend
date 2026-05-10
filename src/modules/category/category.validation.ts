import { z } from "zod";

export const categorySchema = z.object({
	name: z
		.string("Category name is required")
		.nonempty("Category name is required")
		.min(2, "Category must be at least 2 characters long")
		.trim(),
	parentId: z.string().nullish().nullable(),
	sizeGroupId: z.string().nullish().nullable(),
});
