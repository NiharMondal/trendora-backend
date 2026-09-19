import { Router } from "express";
import { wishlistControllers } from "./wishlist.controller";
import { authGuard } from "../../middleware/authGuard";
import { Role } from "../../../generated/prisma";

const router = Router();

/**
 * A VENDOR is also a shopper, so every buyer-facing route accepts all three
 * roles — otherwise approving a seller would break their own wishlist and
 * checkout.
 */
const anySignedInUser = authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN);

router.get("/my-wishlist", anySignedInUser, wishlistControllers.findByUserId);

router
	.route("/:id")
	.get(anySignedInUser, wishlistControllers.findById)
	.delete(anySignedInUser, wishlistControllers.deleteData);

router.post("/", anySignedInUser, wishlistControllers.createIntoDB);

export const wishlistRouter = router;
