import z from "zod";
import { OrderStatusEnum } from "../../helpers/enum";

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

/**
 * A cart may span several stores; the backend groups the items by vendor
 * itself, so the client sends one flat item list exactly as before. Nothing
 * about money or vendor ownership is accepted from the client.
 */
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

/**
 * Fulfilment happens per vendor order, so this targets a VendorOrder id.
 * `trackingNumber`/`carrier` accompany a SHIPPED transition; `cancelReason`
 * accompanies a CANCELED one.
 */
const updateVendorOrderStatusSchema = z.object({
    orderStatus: OrderStatusEnum,
    trackingNumber: z.string().trim().max(120).optional(),
    carrier: z.string().trim().max(80).optional(),
    cancelReason: z.string().trim().max(500).optional(),
});

export type TUpdateVendorOrderStatus = z.infer<
    typeof updateVendorOrderStatusSchema
>;

export const orderValidation = {
    createOrderSchema,
    updateVendorOrderStatusSchema,
};
