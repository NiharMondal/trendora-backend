import z from "zod";

const createVariant = z.object({
	productId: z
		.string({ error: "Product ID is required" })
		.nonempty("Product ID can not be empty")
		.trim(),
	size: z.string({ error: "Variant size is required" }).trim(),
	color: z.string({ error: "Variant color is required" }).trim(),
	stock: z.number({ error: "Variant stock is required" }).positive(),
	price: z.number({ error: "Variant price is required" }).positive(),
});

const addVariants = z
	.array(createVariant)
	.min(1, "At least 1 variant is required");

const updateVariant = createVariant.partial();

export const variantValidation = { createVariant, updateVariant, addVariants };
