"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRouter = void 0;
const express_1 = require("express");
const user_controller_1 = require("./user.controller");
const authGuard_1 = require("../../middleware/authGuard");
const prisma_1 = require("../../../generated/prisma");
const router = (0, express_1.Router)();
router.patch("/my-profile-update", (0, authGuard_1.authGuard)(prisma_1.Role.ADMIN, prisma_1.Role.CUSTOMER, prisma_1.Role.VENDOR), user_controller_1.userControllers.updateData);
router.get("/my-profile", (0, authGuard_1.authGuard)(prisma_1.Role.ADMIN, prisma_1.Role.CUSTOMER, prisma_1.Role.VENDOR), user_controller_1.userControllers.myProfile);
// The full user list is an admin view; it was previously public.
router.get("/", (0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), user_controller_1.userControllers.getAllFromDB);
exports.userRouter = router;
