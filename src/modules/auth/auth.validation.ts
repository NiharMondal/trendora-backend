import { z } from "zod";
import { RoleEnum } from "../../helpers/enum";

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
    phone: z.string().trim().optional(),
    role: RoleEnum.optional(),
    avatar: z.url().trim().optional(),
});

const login = z.object({
    email: z
        .email({ error: "Provide valid email" })
        .nonempty("Email is required"),
    password: z
        .string({ error: "Password is required" })
        .min(6, "Password must be at least 6 characters long"),
});

export const authSchema = { registerUser, login };
