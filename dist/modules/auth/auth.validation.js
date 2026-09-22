"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authSchema = void 0;
const zod_1 = require("zod");
/**
 * The one definition of what a password may be. Registration, change-password
 * and reset-password all share it — three copies is how the rules drift.
 */
const passwordRule = (label = "Password") => zod_1.z
    .string({ error: `${label} is required` })
    .min(6, { error: `${label} must be at least 6 characters long` })
    .max(30, { error: `${label} must not exceed 30 characters` })
    .regex(/[A-Za-z]/, {
    error: `${label} must contain at least one letter`,
})
    .regex(/[0-9]/, { error: `${label} must contain at least one number` })
    .trim();
const registerUser = zod_1.z.object({
    name: zod_1.z
        .string({ error: "Name is required" })
        .nonempty("Name is required")
        .trim(),
    email: zod_1.z.email({ error: "Provide valid email" }),
    password: passwordRule(),
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
    newPassword: passwordRule("New password"),
});
const forgotPassword = zod_1.z.object({
    email: zod_1.z
        .email({ error: "Provide valid email" })
        .nonempty("Email is required"),
});
/**
 * `token` is the raw value from the emailed link's `?token=` param. The server
 * only ever stores its hash, so this is the one moment it exists in a request.
 */
const resetPassword = zod_1.z.object({
    token: zod_1.z
        .string({ error: "Reset token is required" })
        .nonempty("Reset token is required")
        .trim(),
    newPassword: passwordRule("New password"),
});
exports.authSchema = {
    registerUser,
    login,
    oauthLogin,
    changePassword,
    forgotPassword,
    resetPassword,
};
