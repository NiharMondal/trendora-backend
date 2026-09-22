import { Router } from "express";
import { userControllers } from "./user.controller";
import { authGuard } from "@/middleware/authGuard";
import { validateRequest } from "@/middleware/validateRequest";
import { Role } from "@/lib/prisma-client";
import { userUpdateSchema } from "./user.validation";

const router = Router();

router.patch(
	"/my-profile-update",
	authGuard(Role.ADMIN, Role.CUSTOMER, Role.VENDOR),
	validateRequest(userUpdateSchema),
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
