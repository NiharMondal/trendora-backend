"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authSchema = void 0;
const zod_1 = require("zod");
const enum_1 = require("../../helpers/enum.js");
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
/**
 * Which providers `/auth/oauth-login` accepts — a deliberate SUBSET of
 * `AuthProviderEnum`, derived from it rather than hand-copied, so the two can
 * no longer drift.
 *
 * `EMAIL` is excluded because it is the stored default for password accounts,
 * not something anyone signs in *with* here. `FACEBOOK` is excluded because no
 * Facebook OAuth exists on either side of the app: accepting it only let a
 * client create an `OAuthAccount` row that nothing can ever authenticate
 * against. Add it back here the day the flow is actually built.
 */
const OAUTH_PROVIDERS = [enum_1.AuthProviderEnum.enum.GOOGLE];
const oauthProviderSchema = zod_1.z
    .string({ error: "Provider is required" })
    .nonempty("Provider is required")
    .transform((value) => value.toUpperCase())
    .pipe(zod_1.z.enum(OAUTH_PROVIDERS, {
    error: `Provider must be one of: ${OAUTH_PROVIDERS.join(", ")}`,
}));
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
