"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRouter = void 0;
const express_1 = require("express");
const user_controller_1 = require("./user.controller");
const authGuard_1 = require("../../middleware/authGuard.js");
const validateRequest_1 = require("../../middleware/validateRequest.js");
const prisma_client_1 = require("../../lib/prisma-client.js");
const user_validation_1 = require("./user.validation");
const router = (0, express_1.Router)();
router.patch("/my-profile-update", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN, prisma_client_1.Role.CUSTOMER, prisma_client_1.Role.VENDOR), (0, validateRequest_1.validateRequest)(user_validation_1.userUpdateSchema), user_controller_1.userControllers.updateData);
router.get("/my-profile", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN, prisma_client_1.Role.CUSTOMER, prisma_client_1.Role.VENDOR), user_controller_1.userControllers.myProfile);
// The full user list is an admin view; it was previously public.
router.get("/", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), user_controller_1.userControllers.getAllFromDB);
/**
 * Admin user management.
 *
 * Declared AFTER the `/my-profile*` literals above, so neither is matched as an
 * `:id`. Every route here acts on someone else's account: the service refuses
 * to let an admin disable or demote themselves, and refuses to remove the last
 * active admin — there is no way back from either.
 */
router.get("/:id", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), user_controller_1.userControllers.findById);
/**
 * Soft delete, and the ban primitive. `authGuard` already 401s a disabled user
 * and `loginUser` refuses them, so this takes effect on the next request.
 * The frontend has been calling this route into a 404 (XR-02).
 */
router.delete("/:id", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), user_controller_1.userControllers.disableUser);
router.patch("/:id/restore", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), user_controller_1.userControllers.restoreUser);
router.patch("/:id/role", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(user_validation_1.userValidation.updateUserRoleSchema), user_controller_1.userControllers.updateRole);
exports.userRouter = router;
