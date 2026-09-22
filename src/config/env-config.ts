/* eslint-disable no-console */
import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: path.join(process.cwd(), ".env") });

/**
 * Environment configuration, validated at import time.
 *
 * **Everything that reads `process.env` should read it here.** The schema below
 * is the single description of what this service needs to run, and it fails at
 * boot rather than at the first request that happens to touch a missing value.
 *
 * Three tiers, chosen deliberately:
 *
 * - **Required** — no safe default exists and silent failure is worst. A
 *   missing `ACCESS_TOKEN_SECRET` used to be papered over with `as string` and
 *   surfaced as a confusing 500 on the first authenticated request.
 * - **Optional with a default** — every number and every tunable. These are
 *   parsed and range-checked, so `TAX_RATE=abc` is a boot error rather than a
 *   `NaN` that silently makes every order's tax `NaN`.
 * - **Optional, feature-gated** — Stripe, Cloudinary and SMTP. The code already
 *   degrades gracefully without them (`isEmailConfigured`, the scheduler's
 *   Stripe check), so a developer can boot without them; `warnAboutDisabledFeatures`
 *   says plainly what is switched off instead of letting it be a surprise.
 */

/**
 * A number from an env string, falling back when unset and failing loudly when
 * it is set to something that is not a number.
 *
 * Env values are always strings, so this is the only place `Number()` is
 * applied to them — `parseFloat` used to run unguarded, which turned
 * `TAX_RATE=abc` into `NaN` and every order's tax into `NaN`.
 */
const numeric = (label: string, fallback: number) =>
	z
		.string()
		.optional()
		.transform((value, ctx) => {
			if (value === undefined || value.trim() === "") return fallback;

			const parsed = Number(value);
			if (Number.isNaN(parsed)) {
				ctx.addIssue({
					code: "custom",
					message: `${label} must be a number, got "${value}"`,
				});
				return z.NEVER;
			}
			return parsed;
		});

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),

	// ---- required: no safe default ----
	DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
	ACCESS_TOKEN_SECRET: z
		.string()
		.min(1, "ACCESS_TOKEN_SECRET is required (JWTs cannot be signed without it)"),
	REFRESH_TOKEN_SECRET: z
		.string()
		.min(1, "REFRESH_TOKEN_SECRET is required (JWTs cannot be signed without it)"),

	// ---- optional with defaults ----
	PORT: numeric("PORT", 5000),
	FRONTEND_URL: z.string().default("http://localhost:3000"),
	TRUST_PROXY: numeric("TRUST_PROXY", 0),
	BODY_LIMIT: z.string().default("1mb"),
	RATE_LIMIT_API_MAX: numeric("RATE_LIMIT_API_MAX", 1000),
	RATE_LIMIT_LOGIN_MAX: numeric("RATE_LIMIT_LOGIN_MAX", 10),
	RATE_LIMIT_SENSITIVE_MAX: numeric("RATE_LIMIT_SENSITIVE_MAX", 10),
	SCHEDULER_ENABLED: z
		.enum(["true", "false"])
		.default("true")
		.transform((value) => value === "true"),

	// Money. `TAX_RATE` and `PLATFORM_COMMISSION_RATE` are fractions, not
	// percentages — 0.05 is 5%. Bounded so a stray `5` cannot charge 500% tax.
	TAX_RATE: numeric("TAX_RATE", 0.05)
		.refine((n) => n >= 0 && n <= 1, "TAX_RATE must be between 0 and 1 (0.05 = 5%)"),
	PLATFORM_COMMISSION_RATE: numeric("PLATFORM_COMMISSION_RATE", 0.10)
		.refine(
			(n) => n >= 0 && n <= 1,
			"PLATFORM_COMMISSION_RATE must be between 0 and 1 (0.10 = 10%)",
		),
	SHIPPING_COST: numeric("SHIPPING_COST", 100)
		.refine((n) => n >= 0, "SHIPPING_COST cannot be negative"),
	FREE_SHIPPING_THRESHOLD: numeric("FREE_SHIPPING_THRESHOLD", 1000)
		.refine((n) => n >= 0, "FREE_SHIPPING_THRESHOLD cannot be negative"),
	CHECKOUT_SESSION_TTL_MINUTES: numeric("CHECKOUT_SESSION_TTL_MINUTES", 60)
		.refine((n) => n > 0, "CHECKOUT_SESSION_TTL_MINUTES must be positive"),
	PASSWORD_RESET_TTL_MINUTES: numeric("PASSWORD_RESET_TTL_MINUTES", 30)
		.refine((n) => n > 0, "PASSWORD_RESET_TTL_MINUTES must be positive"),
	PASSWORD_RESET_COOLDOWN_SECONDS: numeric("PASSWORD_RESET_COOLDOWN_SECONDS", 60)
		.refine((n) => n >= 0, "PASSWORD_RESET_COOLDOWN_SECONDS cannot be negative"),
	SEED_PASSWORD: z.string().default("Password123!"),

	// ---- optional, feature-gated (see warnAboutDisabledFeatures) ----
	STRIPE_SECRET_KEY: z.string().optional(),
	STRIPE_WEBHOOK_SECRET: z.string().optional(),
	CLOUD_NAME: z.string().optional(),
	API_KEY: z.string().optional(),
	API_SECRET: z.string().optional(),
	EMAIL: z.string().optional(),
	PASSWORD: z.string().optional(),
	EMAIL_HOST: z.string().default("smtp.gmail.com"),
	EMAIL_PORT: numeric("EMAIL_PORT", 465),
	EMAIL_FROM: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	// Fail loudly, at boot, naming every problem at once — not one per restart.
	const problems = parsed.error.issues
		.map((issue) => `  - ${issue.path.join(".") || "(env)"}: ${issue.message}`)
		.join("\n");

	console.error(
		`\nInvalid environment configuration:\n${problems}\n\nSee .env.example for the full list.\n`,
	);
	throw new Error("Invalid environment configuration");
}

const env = parsed.data;

export const envConfig = {
	node_env: env.NODE_ENV,
	port: env.PORT,
	db_url: env.DATABASE_URL,
	access_token_secret: env.ACCESS_TOKEN_SECRET,
	refresh_token_secret: env.REFRESH_TOKEN_SECRET,
	front_end_url: env.FRONTEND_URL,
	stripe_secret_key: env.STRIPE_SECRET_KEY,
	stripe_webhook_secret: env.STRIPE_WEBHOOK_SECRET,
	cloudinary: {
		cloud_name: env.CLOUD_NAME,
		api_key: env.API_KEY,
		api_secret: env.API_SECRET,
	},
	emailUtils: {
		// SMTP user + password. For Gmail, PASSWORD must be an app password,
		// not the account password.
		email: env.EMAIL,
		password: env.PASSWORD,
		host: env.EMAIL_HOST,
		port: env.EMAIL_PORT,
		/** What recipients see in the From line. Defaults to the SMTP user. */
		from: env.EMAIL_FROM || env.EMAIL,
	},
	/** How long an emailed password-reset link stays redeemable, in minutes. */
	password_reset_ttl_minutes: env.PASSWORD_RESET_TTL_MINUTES,
	/**
	 * Minimum gap between two reset emails for the same account, in seconds.
	 * The per-account counterpart to `sensitiveAuthLimiter`.
	 */
	password_reset_cooldown_seconds: env.PASSWORD_RESET_COOLDOWN_SECONDS,
	/** Reverse-proxy hops in front of this app, for Express's `trust proxy`. */
	trust_proxy: env.TRUST_PROXY,
	/** Per-IP request budgets, each over a 15-minute window. */
	rate_limit: {
		api_max: env.RATE_LIMIT_API_MAX,
		login_max: env.RATE_LIMIT_LOGIN_MAX,
		sensitive_max: env.RATE_LIMIT_SENSITIVE_MAX,
	},
	/** Maximum accepted request body size. */
	body_limit: env.BODY_LIMIT,
	/**
	 * Whether this process runs the background sweeps (`src/scheduler`).
	 * In-process, so with several instances leave it on for exactly one.
	 */
	scheduler_enabled: env.SCHEDULER_ENABLED,
	/** dev seed (src/seed) — not used by the running server */
	seed_password: env.SEED_PASSWORD,
	// order related
	tax_rate: env.TAX_RATE,
	/**
	 * Platform-wide DEFAULTS for a new vendor. Once a store exists these live
	 * on the Vendor row, which is what order pricing actually reads.
	 */
	shipping_cost: env.SHIPPING_COST,
	free_shipping_threshold: env.FREE_SHIPPING_THRESHOLD,
	/** Platform cut of a vendor's merchandise subtotal, e.g. 0.10 = 10%. */
	platform_commission_rate: env.PLATFORM_COMMISSION_RATE,
	/** How long an unpaid checkout draft stays redeemable, in minutes. */
	checkout_session_ttl_minutes: env.CHECKOUT_SESSION_TTL_MINUTES,
};

/**
 * Say plainly which features are switched off, rather than letting a developer
 * discover it when a checkout silently fails.
 */
export const warnAboutDisabledFeatures = (): void => {
	const disabled: string[] = [];

	if (!envConfig.stripe_secret_key)
		disabled.push("Stripe payments (STRIPE_SECRET_KEY)");
	if (!envConfig.stripe_webhook_secret)
		disabled.push("Stripe webhook verification (STRIPE_WEBHOOK_SECRET)");
	if (!envConfig.cloudinary.cloud_name || !envConfig.cloudinary.api_secret)
		disabled.push("Cloudinary image handling (CLOUD_NAME / API_KEY / API_SECRET)");
	if (!envConfig.emailUtils.email || !envConfig.emailUtils.password)
		disabled.push("Transactional email (EMAIL / PASSWORD)");

	if (disabled.length > 0) {
		console.warn(
			`[config] running with these features DISABLED:\n${disabled
				.map((item) => `  - ${item}`)
				.join("\n")}`,
		);
	}
};
