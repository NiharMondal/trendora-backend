import z from "zod";

/**
 * Only `productId` comes from the client. `userId` is taken from the verified
 * JWT in the controller and must never be accepted from the body — letting the
 * caller name the owner is how one account writes into another's wishlist.
 *
 * (This schema used to require `userId` too, which is why it could not be wired
 * to `validateRequest`: the frontend has never sent that field, so every
 * request would have 400'd.)
 */
export const createWishList = z.object({
	productId: z.uuidv4("ProductId can not be empty"),
});

export type TCreateWishListType = z.infer<typeof createWishList>;
