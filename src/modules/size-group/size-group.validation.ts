import z from "zod";

export const sizeGroupSchema = z.object({
	name: z
		.string({ error: "Name is required" })
		.nonempty({ error: "Name is required" })
		.trim(),
});
