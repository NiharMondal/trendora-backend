import { Router } from "express";
import { wishlistControllers } from "./wishlist.controller";
import { authGuard } from "../../middleware/authGuard";
import { Role } from "../../../generated/prisma";

const router = Router();

router
	.route("/my-wishlists")
	.post(authGuard(Role.CUSTOMER), wishlistControllers.createIntoDB)
	.get(authGuard(Role.CUSTOMER), wishlistControllers.findByUserId);

router
	.route("/:id")
	.get(wishlistControllers.findById)
	.delete(wishlistControllers.deleteData);

export const wishlistRouter = router;
