import z from "zod";

export const addressSchema = z.object({
    fullName: z.string({ error: "Name is required" }).trim(),
    email: z.email().trim(),
    phone: z.string({ error: "Phone number is required" }).trim(),
    street: z.string({ error: "Street is required" }).trim(),
    city: z.string({ error: "City name is required" }).trim(),
    state: z.string().trim().optional(),
    postalCode: z.string({ error: "Postal code is required" }).trim(),
    country: z.string({ error: "Country name is required" }).trim(),
    isDefault: z.boolean().optional()
});
export type TAddressValues = z.infer<typeof addressSchema>