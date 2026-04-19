import z from "zod";

export const userUpdateSchema = z.object({
	name: z.string().optional(),
	phone: z.string().optional(),
	avatar: z
		.object({
			url: z.string().optional(),
			publicId: z.string().optional(),
		})
		.optional(),
});

export type TUserUpdateSchema = z.infer<typeof userUpdateSchema>;