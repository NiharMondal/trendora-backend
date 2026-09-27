"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const validateRequest_1 = require("../../middleware/validateRequest.js");
const auth_validation_1 = require("./auth.validation");
const authGuard_1 = require("../../middleware/authGuard.js");
const rateLimiter_1 = require("../../middleware/rateLimiter.js");
const prisma_client_1 = require("../../lib/prisma-client.js");
const router = (0, express_1.Router)();
/**
 * The limiters are applied per endpoint rather than to the whole router on
 * purpose. `/refresh-token` is called by every signed-in browser roughly every
 * 20 minutes, and `/oauth-login` on every Google sign-in — throttling those at
 * credential-guessing rates would break sessions for everyone behind one NAT.
 * Only the endpoints that are actually attack surface are limited.
 */
router.post("/register", rateLimiter_1.sensitiveAuthLimiter, (0, validateRequest_1.validateRequest)(auth_validation_1.authSchema.registerUser), auth_controller_1.authControllers.registerUser);
// `loginLimiter` skips successful requests, so a real user is never locked out
// by their own logins while a stuffing run burns the budget in seconds.
router.post("/login", rateLimiter_1.loginLimiter, (0, validateRequest_1.validateRequest)(auth_validation_1.authSchema.login), auth_controller_1.authControllers.loginUser);
router.post("/oauth-login", (0, validateRequest_1.validateRequest)(auth_validation_1.authSchema.oauthLogin), auth_controller_1.authControllers.oAuthLogin);
router.post("/change-password", (0, authGuard_1.authGuard)(prisma_client_1.Role.CUSTOMER, prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(auth_validation_1.authSchema.changePassword), auth_controller_1.authControllers.changePassword);
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
router.post("/forgot-password", rateLimiter_1.sensitiveAuthLimiter, (0, validateRequest_1.validateRequest)(auth_validation_1.authSchema.forgotPassword), auth_controller_1.authControllers.forgotPassword);
router.post("/reset-password", rateLimiter_1.sensitiveAuthLimiter, (0, validateRequest_1.validateRequest)(auth_validation_1.authSchema.resetPassword), auth_controller_1.authControllers.resetPassword);
exports.authRouter = router;
