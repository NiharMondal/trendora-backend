"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authSchema = void 0;
const zod_1 = require("zod");
const registerUser = zod_1.z.object({
    name: zod_1.z
        .string({ error: "Name is required" })
        .nonempty("Name is required")
        .trim(),
    email: zod_1.z.email({ error: "Provide valid email" }),
    password: zod_1.z
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
const login = zod_1.z.object({
    email: zod_1.z
        .email({ error: "Provide valid email" })
        .nonempty("Email is required"),
    password: zod_1.z
        .string({ error: "Password is required" })
        .min(6, "Password must be at least 6 characters long"),
});
const oauthProviderSchema = zod_1.z
    .string({ error: "Provider is required" })
    .nonempty("Provider is required")
    .transform((value) => value.toUpperCase())
    .refine((value) => value === "GOOGLE" || value === "FACEBOOK", {
    error: "Provider must be GOOGLE or FACEBOOK",
});
const oauthLogin = zod_1.z.object({
    name: zod_1.z
        .string({ error: "Name is required" })
        .nonempty("Name is required")
        .trim(),
    email: zod_1.z
        .email({ error: "Provide valid email" })
        .nonempty("Email is required"),
    provider: oauthProviderSchema,
    providerId: zod_1.z
        .string({ error: "Provider ID is required" })
        .nonempty("Provider ID is required"),
    avatar: zod_1.z.url().optional(),
});
const changePassword = zod_1.z.object({
    oldPassword: zod_1.z
        .string("Old password is required")
        .min(6, "Old password is required"),
    newPassword: zod_1.z
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
});
exports.authSchema = { registerUser, login, oauthLogin, changePassword };
