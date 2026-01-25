import z from "zod";

export const addressSchema = z.object({
    userId: z
        .string({ error: "User ID is required" })
        .nonempty({ error: "User ID can not be empty" })
        .trim(),
    fullName: z.string({ error: "Name is required" }).trim(),
    phone: z.string({ error: "Phone number is required" }).trim(),
    street: z.string({ error: "Street is required" }).trim(),
    city: z.string({ error: "City name is required" }).trim(),
    state: z.string().trim().optional(),
    postalCode: z.string({ error: "Postal code is required" }).trim(),
    country: z.string({ error: "Country name is required" }).trim(),
});
