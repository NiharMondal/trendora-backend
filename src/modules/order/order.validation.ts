import z from "zod";

const orderItems = z.array(
	z.object({
		productId: z
			.string({ error: "User ID is required" })
			.nonempty({ error: "User ID can not be empty" }),
		productName: z
			.string({ error: "Product name is required" })
			.nonempty({ error: "Product name can not be empty" }),
		variantId: z
			.string({ error: "User ID is required" })
			.nonempty({ error: "User ID can not be empty" })
			.optional(),
		price: z.number({ error: "Price is required" }),
		quantity: z.number({ error: "Quantity is required" }),
	})
);
const createOrderSchema = z.object({
	userId: z
		.string({ error: "User ID is required" })
		.nonempty({ error: "User ID can not be empty" }),
	paymentMethod: z.enum(["STRIPE", "SSLCOMMERZ", "CASH_ON_DELIVERY"]),
	shippingAddressId: z
		.string({ error: "Shipping address ID is required" })
		.nonempty({ error: "Shipping address ID can not be empty" }),
	items: orderItems.min(1, "Order should contain one item"),
});
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
