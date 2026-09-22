import rateLimit from "express-rate-limit";
import { envConfig } from "@/config/env-config";

/**
 * Rate limiters.
 *
 * Deliberately **not** applied to `POST /webhook` — Stripe retries a failed
 * delivery, and throttling those retries would silently lose orders and refund
 * reconciliation. The webhook is mounted above these in `app.ts`, so it is
 * excluded by position; keep it that way.
 *
 * All limits are per IP, which means `trust proxy` has to be right in
 * production or every request appears to come from the load balancer and one
 * noisy client throttles everyone. See `TRUST_PROXY` in `.env.example`.
 */

const WINDOW_MS = 15 * 60 * 1000;

/** The standard `{ success, message, errorDetails }` error envelope. */
const limitResponse = (message: string) => ({
	success: false,
	message,
	errorDetails: "Rate limit exceeded",
});

/**
 * Broad limit across the whole API. Generous on purpose — a storefront page
 * makes several calls, and this exists to stop scraping and floods, not to
 * shape normal browsing.
 */
export const apiLimiter = rateLimit({
	windowMs: WINDOW_MS,
	limit: envConfig.rate_limit.api_max,
	standardHeaders: "draft-7",
	legacyHeaders: false,
	message: limitResponse(
		"Too many requests. Please try again in a few minutes.",
	),
});

/**
 * Login. `skipSuccessfulRequests` means only **failed** attempts count, so a
 * legitimate user is never locked out by their own successful logins while
 * credential stuffing still burns the budget fast.
 */
export const loginLimiter = rateLimit({
	windowMs: WINDOW_MS,
	limit: envConfig.rate_limit.login_max,
	skipSuccessfulRequests: true,
	standardHeaders: "draft-7",
	legacyHeaders: false,
	message: limitResponse(
		"Too many failed login attempts. Please try again later.",
	),
});

/**
 * Endpoints where a *successful* call is itself the cost: registration creates
 * an account, and forgot/reset-password send mail. Every request counts here,
 * unlike `loginLimiter`.
 *
 * This is the IP-level counterpart to the per-account cooldown in
 * `authServices.forgotPassword` — that stops one address being mail-bombed,
 * this stops one client walking a list of addresses.
 */
export const sensitiveAuthLimiter = rateLimit({
	windowMs: WINDOW_MS,
	limit: envConfig.rate_limit.sensitive_max,
	standardHeaders: "draft-7",
	legacyHeaders: false,
	message: limitResponse(
		"Too many attempts. Please try again in a few minutes.",
	),
});
