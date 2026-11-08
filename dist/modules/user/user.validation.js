"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userValidation = exports.updateUserRoleSchema = exports.userUpdateSchema = void 0;
const zod_1 = __importDefault(require("zod"));
const enum_1 = require("../../helpers/enum.js");
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
exports.userUpdateSchema = zod_1.default.object({
    name: zod_1.default
        .string({ error: "Full name is required" })
        .trim()
        .min(1, "Full name is required"),
    phone: zod_1.default
        .string({ error: "Contact number is required" })
        .trim()
        .min(1, "Contact number is required"),
    avatar: zod_1.default
        .object({
        url: zod_1.default.string().optional(),
        publicId: zod_1.default.string().optional(),
    })
        .optional(),
});
/**
 * Body of `PATCH /users/:id/role`.
 *
 * `Role` is the only field an admin may set on someone else's account here.
 * Everything else about another user is either theirs to change (profile) or
 * derived (vendor status), and a wider schema would be a standing invitation to
 * add something that is not.
 */
exports.updateUserRoleSchema = zod_1.default.object({
    role: enum_1.RoleEnum,
});
exports.userValidation = { userUpdateSchema: exports.userUpdateSchema, updateUserRoleSchema: exports.updateUserRoleSchema };
