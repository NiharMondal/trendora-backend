import { z } from "zod";

const registerUser = z.object({
    name: z
        .string({ error: "Name is required" })
        .nonempty("Name is required")
        .trim(),
    email: z.email({ error: "Provide valid email" }),
    password: z
        .string({
            error: "Password is required",
        })
        .min(6, {
            error: "Password must be at least 6 characters long",
        })
        .max(30, {
            error: "Password must not exceed 30 characters",
        })
        .regex(/[A-Za-z]/, {
            error: "Password must contain at least one letter",
        })
        .regex(/[0-9]/, {
            error: "Password must contain at least one number",
        })
        .trim(),
});

export type TRegisterUserType = z.infer<typeof registerUser>

const login = z.object({
    email: z
        .email({ error: "Provide valid email" })
        .nonempty("Email is required"),
    password: z
        .string({ error: "Password is required" })
        .min(6, "Password must be at least 6 characters long"),
});

const oauthProviderSchema = z
    .string({ error: "Provider is required" })
    .nonempty("Provider is required")
    .transform((value) => value.toUpperCase())
    .refine((value) => value === "GOOGLE" || value === "FACEBOOK", {
        error: "Provider must be GOOGLE or FACEBOOK",
    });

const oauthLogin = z.object({
    name: z
        .string({ error: "Name is required" })
        .nonempty("Name is required")
        .trim(),
    email: z
        .email({ error: "Provide valid email" })
        .nonempty("Email is required"),
    provider: oauthProviderSchema,
    providerId: z
        .string({ error: "Provider ID is required" })
        .nonempty("Provider ID is required"),
    avatar: z.url().optional(),
});

const changePassword = z.object({
    oldPassword: z.string("Old password is required").min(6, "Old password is required"),
    newPassword: z
    .string({
        error: "New password is required",
    })
    .min(6, {
        error: "Password must be at least 6 characters long",
    })
    .max(30, {
        error: "Password must not exceed 30 characters",
    })
    .regex(/[A-Za-z]/, {
        error: "Password must contain at least one letter",
    })
    .regex(/[0-9]/, {
        error: "Password must contain at least one number",
    })
    .trim(),
})
export const authSchema = { registerUser, login, oauthLogin, changePassword };
