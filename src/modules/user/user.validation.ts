import z from "zod";

export const userUpdateSchema = z.object({
	name: z.string("Full name is required").min(5, "Minimum 5 length is required"),
	phone: z.string().min(1, "Contact number is required"),
	avatar: z
		.object({
			url: z.string().optional(),
			publicId: z.string().optional(),
		})
		.optional(),
});

export type TUserUpdateSchema = z.infer<typeof userUpdateSchema>;