import { Router } from "express";
import { userControllers } from "./user.controller";
import { authGuard } from "../../middleware/authGuard";
import { Role } from "../../../generated/prisma";

const router = Router();

router.patch(
	"/my-profile-update",
	authGuard(Role.ADMIN, Role.CUSTOMER, Role.VENDOR),
	userControllers.updateData,
);
router.get(
	"/my-profile",
	authGuard(Role.ADMIN, Role.CUSTOMER, Role.VENDOR),
	userControllers.myProfile,
);
// The full user list is an admin view; it was previously public.
router.get("/", authGuard(Role.ADMIN), userControllers.getAllFromDB);

export const userRouter = router;
