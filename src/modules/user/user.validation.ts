import z from "zod";

import { RoleEnum } from "@/helpers/enum";

/**
 * Body of `PATCH /users/my-profile-update`.
 *
 * `name` is `min(1)`, not `min(5)`. Registration accepts any non-empty name
 * (`authSchema.registerUser`), so a stricter rule here would lock anyone who
 * signed up as "Li" or "Ann" out of their own profile forever — and plenty of
 * real names are shorter than five characters. It also matches the frontend's
 * `profileFormSchema`, which is what actually submits this form.
 *
 * `.trim()` runs before `.min(1)`, so a whitespace-only name is rejected rather
 * than silently stored as blank.
 *
 * Note this is a full replace, not a partial patch: `name` and `phone` are both
 * required, which is what the profile form always sends.
 */
export const userUpdateSchema = z.object({
	name: z
		.string({ error: "Full name is required" })
		.trim()
		.min(1, "Full name is required"),
	phone: z
		.string({ error: "Contact number is required" })
		.trim()
		.min(1, "Contact number is required"),
	avatar: z
		.object({
			url: z.string().optional(),
			publicId: z.string().optional(),
		})
		.optional(),
});

export type TUserUpdateSchema = z.infer<typeof userUpdateSchema>;

/**
 * Body of `PATCH /users/:id/role`.
 *
 * `Role` is the only field an admin may set on someone else's account here.
 * Everything else about another user is either theirs to change (profile) or
 * derived (vendor status), and a wider schema would be a standing invitation to
 * add something that is not.
 */
export const updateUserRoleSchema = z.object({
	role: RoleEnum,
});

export type TUpdateUserRole = z.infer<typeof updateUserRoleSchema>;

export const userValidation = { userUpdateSchema, updateUserRoleSchema };
