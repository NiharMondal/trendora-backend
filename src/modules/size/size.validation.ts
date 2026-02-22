import z from "zod";

export const sizeSchema = z.object({
    name: z.string("Name is required").min(1, "Min length is 1").trim(),
    sizeGroupId: z.string("Size group ID is required")
})