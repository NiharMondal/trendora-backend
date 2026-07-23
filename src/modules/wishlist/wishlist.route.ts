import { Router } from "express";
import { wishlistControllers } from "./wishlist.controller";
import { authGuard } from "../../middleware/authGuard";
import { Role } from "../../../generated/prisma";

const router = Router();

router.get(
	"/my-wishlist",
	authGuard(Role.CUSTOMER),
	wishlistControllers.findByUserId,
);

router
	.route("/:id")
	.get(authGuard(Role.CUSTOMER), wishlistControllers.findById)
	.delete(authGuard(Role.CUSTOMER), wishlistControllers.deleteData);

router.post("/", authGuard(Role.CUSTOMER), wishlistControllers.createIntoDB);
export const wishlistRouter = router;
