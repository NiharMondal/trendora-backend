import z from "zod";

const orderItems = z.array(
    z.object({
        productId: z
            .string({ error: "Product ID is required" })
            .nonempty({ error: "Product ID can not be empty" }),
        variantId: z
            .string({ error: "Variant ID is required" })
            .nonempty({ error: "Variant ID can not be empty" })
            .optional(),
        quantity: z.number({ error: "Quantity is required" }),
    })
);
const createOrderSchema = z.object({
    paymentMethod: z.enum(["STRIPE", "CASH_ON_DELIVERY"]),
    shippingAddressId: z
        .string()
        .optional()
        .transform((val) =>
            val === "" || val === undefined ? undefined : val,
        )
        .pipe(z.uuidv4("Please select an address").optional()),
    address: z.object({
        fullName: z.string({ error: "Name is required" }).trim(),
        email: z.email().trim(),
        phone: z.string({ error: "Phone number is required" }).trim(),
        street: z.string({ error: "Street is required" }).trim(),
        city: z.string({ error: "City name is required" }).trim(),
        state: z.string().trim().optional(),
        postalCode: z.string({ error: "Postal code is required" }).trim(),
        country: z.string({ error: "Country name is required" }).trim(),
    }).optional(),
    items: orderItems.min(1, "Order should contain one item"),
    notes: z.string().optional(),
});

export type TCreateOrderSchema = z.infer<typeof createOrderSchema>;


const updateOrderStatusSchema = z.object({
    orderStatus: z.enum([
        "PENDING",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELED",
    ]),
});

export const orderValidation = { createOrderSchema, updateOrderStatusSchema };
