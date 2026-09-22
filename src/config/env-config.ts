import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export const envConfig = {
	node_env: process.env.NODE_ENV,
	port: parseInt(process.env.PORT || "5000"),
	db_url: process.env.DATABASE_URL,
	access_token_secret: process.env.ACCESS_TOKEN_SECRET,
	refresh_token_secret: process.env.REFRESH_TOKEN_SECRET,
	front_end_url: process.env.FRONTEND_URL,
	stripe_secret_key: process.env.STRIPE_SECRET_KEY,
	stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
	ssl: {
		api: process.env.SSL_COMMERZ_API,
		storeId: process.env.SSL_STORE_ID,
		storePass: process.env.SSL_STORE_PASSWORD,
	},
	cloudinary: {
		cloud_name: process.env.CLOUD_NAME,
		api_key: process.env.API_KEY,
		api_secret: process.env.API_SECRET,
	},
	emailUtils: {
		// SMTP user + password. For Gmail, PASSWORD must be an app password,
		// not the account password.
		email: process.env.EMAIL,
		password: process.env.PASSWORD,
		host: process.env.EMAIL_HOST || "smtp.gmail.com",
		port: parseInt(process.env.EMAIL_PORT || "465", 10),
		/** What recipients see in the From line. Defaults to the SMTP user. */
		from: process.env.EMAIL_FROM || process.env.EMAIL,
	},
	/**
	 * How long an emailed password-reset link stays redeemable, in minutes.
	 * Short on purpose: the link is a bearer credential sitting in an inbox.
	 */
	password_reset_ttl_minutes: parseInt(
		process.env.PASSWORD_RESET_TTL_MINUTES || "30",
		10,
	),
	/**
	 * Minimum gap between two reset emails for the same account, in seconds.
	 * The per-account counterpart to `sensitiveAuthLimiter`: this stops one
	 * address being mail-bombed, the limiter stops one client walking a list.
	 */
	password_reset_cooldown_seconds: parseInt(
		process.env.PASSWORD_RESET_COOLDOWN_SECONDS || "60",
		10,
	),
	/**
	 * Number of reverse-proxy hops in front of this app, for Express's
	 * `trust proxy`. **0 means no proxy** (local dev, or a directly exposed
	 * container). Behind one load balancer this is 1.
	 *
	 * Getting it wrong breaks per-IP rate limiting in opposite ways: too low and
	 * every request looks like it came from the proxy, so one noisy client
	 * throttles everybody; too high and a client can spoof `X-Forwarded-For` to
	 * dodge the limit entirely.
	 */
	trust_proxy: parseInt(process.env.TRUST_PROXY || "0", 10),
	/** Per-IP request budgets, each over a 15-minute window. */
	rate_limit: {
		/** Whole API. Generous — a storefront page makes several calls. */
		api_max: parseInt(process.env.RATE_LIMIT_API_MAX || "1000", 10),
		/** Failed logins only (successful ones are not counted). */
		login_max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || "10", 10),
		/** Register / forgot-password / reset-password; counts every request. */
		sensitive_max: parseInt(process.env.RATE_LIMIT_SENSITIVE_MAX || "10", 10),
	},
	/** Maximum accepted request body size. */
	body_limit: process.env.BODY_LIMIT || "1mb",
	/**
	 * Whether this process runs the background sweeps (`src/scheduler`).
	 *
	 * The scheduler is in-process, so **every** instance that has this on runs
	 * every sweep. The jobs tolerate it — gateway calls are idempotency-keyed
	 * and the sweeps are `updateMany` — but it is duplicated work, so with more
	 * than one instance deployed, leave it on for exactly one of them.
	 */
	scheduler_enabled: (process.env.SCHEDULER_ENABLED ?? "true") !== "false",
	// dev seed (src/seed) — not used by the running server
	seed_password: process.env.SEED_PASSWORD || "Password123!",
	// order related
	tax_rate: parseFloat(process.env.TAX_RATE || "0.08"),
	// Platform-wide DEFAULTS for a new vendor. Once a store exists these live
	// on the Vendor row (shippingFee / freeShippingThreshold / commissionRate),
	// which is what order pricing actually reads — changing them here only
	// affects stores created afterwards.
	shipping_cost: parseFloat(process.env.SHIPPING_COST || "100.00"),
	free_shipping_threshold: parseFloat(
		process.env.FREE_SHIPPING_THRESHOLD || "1000.00",
	),
	// marketplace
	/** Platform cut of a vendor's merchandise subtotal, e.g. 0.10 = 10%. */
	platform_commission_rate: parseFloat(
		process.env.PLATFORM_COMMISSION_RATE || "0.10",
	),
	/** How long an unpaid checkout draft stays redeemable, in minutes. */
	checkout_session_ttl_minutes: parseInt(
		process.env.CHECKOUT_SESSION_TTL_MINUTES || "60",
		10,
	),
};
