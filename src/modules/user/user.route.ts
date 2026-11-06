import { Router } from "express";
import { userControllers } from "./user.controller";
import { authGuard } from "@/middleware/authGuard";
import { validateRequest } from "@/middleware/validateRequest";
import { Role } from "@/lib/prisma-client";
import { userUpdateSchema, userValidation } from "./user.validation";

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

/**
 * Admin user management.
 *
 * Declared AFTER the `/my-profile*` literals above, so neither is matched as an
 * `:id`. Every route here acts on someone else's account: the service refuses
 * to let an admin disable or demote themselves, and refuses to remove the last
 * active admin — there is no way back from either.
 */
router.get("/:id", authGuard(Role.ADMIN), userControllers.findById);

/**
 * Soft delete, and the ban primitive. `authGuard` already 401s a disabled user
 * and `loginUser` refuses them, so this takes effect on the next request.
 * The frontend has been calling this route into a 404 (XR-02).
 */
router.delete("/:id", authGuard(Role.ADMIN), userControllers.disableUser);

router.patch(
	"/:id/restore",
	authGuard(Role.ADMIN),
	userControllers.restoreUser,
);

router.patch(
	"/:id/role",
	authGuard(Role.ADMIN),
	validateRequest(userValidation.updateUserRoleSchema),
	userControllers.updateRole,
);

export const userRouter = router;
