"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sensitiveAuthLimiter = exports.loginLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_config_1 = require("../config/env-config.js");
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
const limitResponse = (message) => ({
    success: false,
    message,
    errorDetails: "Rate limit exceeded",
});
/**
 * Broad limit across the whole API. Generous on purpose — a storefront page
 * makes several calls, and this exists to stop scraping and floods, not to
 * shape normal browsing.
 */
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: WINDOW_MS,
    limit: env_config_1.envConfig.rate_limit.api_max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: limitResponse("Too many requests. Please try again in a few minutes."),
});
/**
 * Login. `skipSuccessfulRequests` means only **failed** attempts count, so a
 * legitimate user is never locked out by their own successful logins while
 * credential stuffing still burns the budget fast.
 */
exports.loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: WINDOW_MS,
    limit: env_config_1.envConfig.rate_limit.login_max,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: limitResponse("Too many failed login attempts. Please try again later."),
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
exports.sensitiveAuthLimiter = (0, express_rate_limit_1.default)({
    windowMs: WINDOW_MS,
    limit: env_config_1.envConfig.rate_limit.sensitive_max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: limitResponse("Too many attempts. Please try again in a few minutes."),
});
