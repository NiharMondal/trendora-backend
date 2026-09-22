"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.envConfig = void 0;
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: path_1.default.join(process.cwd(), ".env") });
exports.envConfig = {
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
    password_reset_ttl_minutes: parseInt(process.env.PASSWORD_RESET_TTL_MINUTES || "30", 10),
    /**
     * Minimum gap between two reset emails for the same account, in seconds.
     * Stops one address being used to mail-bomb another while there is still
     * no global rate limiter (see docs/FEATURE-GAPS.md BE-05).
     */
    password_reset_cooldown_seconds: parseInt(process.env.PASSWORD_RESET_COOLDOWN_SECONDS || "60", 10),
    // dev seed (src/seed) — not used by the running server
    seed_password: process.env.SEED_PASSWORD || "Password123!",
    // order related
    tax_rate: parseFloat(process.env.TAX_RATE || "0.08"),
    // Platform-wide DEFAULTS for a new vendor. Once a store exists these live
    // on the Vendor row (shippingFee / freeShippingThreshold / commissionRate),
    // which is what order pricing actually reads — changing them here only
    // affects stores created afterwards.
    shipping_cost: parseFloat(process.env.SHIPPING_COST || "100.00"),
    free_shipping_threshold: parseFloat(process.env.FREE_SHIPPING_THRESHOLD || "1000.00"),
    // marketplace
    /** Platform cut of a vendor's merchandise subtotal, e.g. 0.10 = 10%. */
    platform_commission_rate: parseFloat(process.env.PLATFORM_COMMISSION_RATE || "0.10"),
    /** How long an unpaid checkout draft stays redeemable, in minutes. */
    checkout_session_ttl_minutes: parseInt(process.env.CHECKOUT_SESSION_TTL_MINUTES || "60", 10),
};
