import z from "zod";
import { uuidSchema } from "../../utils/utils";

export const createWishList = z.object({
	userId: z.uuidv4("UserId can not be empty"),
	productId: z.uuidv4("ProductId can not be empty"),
});

export type TCreateWishListType = z.infer<typeof createWishList>;
