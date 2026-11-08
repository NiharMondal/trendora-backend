import { z } from "zod";

/**
 * The module had no schema at all, so `publicId` was read straight off
 * `req.body`: a request without it threw a TypeError on `.includes` and
 * returned a 500 instead of a 400.
 */
export const deleteTempSchema = z.object({
    publicId: z
        .string({ error: "publicId is required" })
        .nonempty("publicId is required"),
});

export type TDeleteTemp = z.infer<typeof deleteTempSchema>;

export const cloudinaryValidation = { deleteTempSchema };
