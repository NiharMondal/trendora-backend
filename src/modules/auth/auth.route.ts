import { Router } from "express";
import { authControllers } from "./auth.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { authSchema } from "./auth.validation";
import { authGuard } from "../../middleware/authGuard";
import {
	loginLimiter,
	sensitiveAuthLimiter,
} from "../../middleware/rateLimiter";
import { Role } from "../../../generated/prisma";

const router = Router();

/**
 * The limiters are applied per endpoint rather than to the whole router on
 * purpose. `/refresh-token` is called by every signed-in browser roughly every
 * 20 minutes, and `/oauth-login` on every Google sign-in — throttling those at
 * credential-guessing rates would break sessions for everyone behind one NAT.
 * Only the endpoints that are actually attack surface are limited.
 */
router.post(
    "/register",
    sensitiveAuthLimiter,
    validateRequest(authSchema.registerUser),
    authControllers.registerUser
);

// `loginLimiter` skips successful requests, so a real user is never locked out
// by their own logins while a stuffing run burns the budget in seconds.
router.post(
    "/login",
    loginLimiter,
    validateRequest(authSchema.login),
    authControllers.loginUser
);

router.post(
    "/oauth-login",
    validateRequest(authSchema.oauthLogin),
    authControllers.oAuthLogin
);
router.post(
    "/change-password",
    authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN),
    validateRequest(authSchema.changePassword),
    authControllers.changePassword
);
router.post("/refresh-token", authControllers.refreshToken);

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
router.post(
	"/forgot-password",
	sensitiveAuthLimiter,
	validateRequest(authSchema.forgotPassword),
	authControllers.forgotPassword,
);

router.post(
	"/reset-password",
	sensitiveAuthLimiter,
	validateRequest(authSchema.resetPassword),
	authControllers.resetPassword,
);

export const authRouter = router;
