import z from "zod";

const createAddress = z.object({
	userId: z
		.string({ error: "User ID is required" })
		.nonempty({ error: "User ID can not be empty" }),
	fullName: z.string({ error: "Name is required" }),
	phone: z.string({ error: "Phone number is required" }),
	street: z.string({ error: "Street is required" }),
	city: z.string({ error: "City name is required" }),
	state: z.string({ error: "State name is required" }).optional(),
	postalCode: z.string({ error: "Postal code is required" }),
	country: z.string({ error: "Country name is required" }),
});

export const addressValidation = { createAddress };
