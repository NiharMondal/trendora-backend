"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const validateRequest_1 = require("../../middleware/validateRequest");
const auth_validation_1 = require("./auth.validation");
const authGuard_1 = require("../../middleware/authGuard");
const prisma_1 = require("../../../generated/prisma");
const router = (0, express_1.Router)();
router.post("/register", (0, validateRequest_1.validateRequest)(auth_validation_1.authSchema.registerUser), auth_controller_1.authControllers.registerUser);
router.post("/login", (0, validateRequest_1.validateRequest)(auth_validation_1.authSchema.login), auth_controller_1.authControllers.loginUser);
router.post("/oauth-login", (0, validateRequest_1.validateRequest)(auth_validation_1.authSchema.oauthLogin), auth_controller_1.authControllers.oAuthLogin);
router.post("/change-password", (0, authGuard_1.authGuard)(prisma_1.Role.CUSTOMER, prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(auth_validation_1.authSchema.changePassword), auth_controller_1.authControllers.changePassword);
router.post("/refresh-token", auth_controller_1.authControllers.refreshToken);
/**
 * Password reset is two public steps:
 *   1. POST /forgot-password { email }            -> emails a single-use link
 *   2. POST /reset-password  { token, newPassword } -> redeems it
 *
 * Step 1 answers identically for every input on purpose (see the service), so
 * it cannot be used to discover which addresses have accounts. The token is
 * never in a response body — only in the emailed URL.
 *
 * Both are unauthenticated and currently unthrottled beyond the per-account
 * cooldown in the service; see docs/FEATURE-GAPS.md BE-05.
 */
router.post("/forgot-password", (0, validateRequest_1.validateRequest)(auth_validation_1.authSchema.forgotPassword), auth_controller_1.authControllers.forgotPassword);
router.post("/reset-password", (0, validateRequest_1.validateRequest)(auth_validation_1.authSchema.resetPassword), auth_controller_1.authControllers.resetPassword);
exports.authRouter = router;
