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
		email: process.env.EMAIL,
		password: process.env.PASSWORD,
	},
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
