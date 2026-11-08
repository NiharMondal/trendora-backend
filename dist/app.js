"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const rootRouter_1 = __importDefault(require("./routes/rootRouter"));
const notFoundRoute_1 = require("./middleware/notFoundRoute");
const globalErrorHandler_1 = require("./middleware/globalErrorHandler");
const payment_route_1 = require("./modules/payment/payment.route");
const health_route_1 = require("./routes/health.route");
const rateLimiter_1 = require("./middleware/rateLimiter");
const env_config_1 = require("./config/env-config");
const app = (0, express_1.default)();
/**
 * Middleware order here is load-bearing. Read the comments before moving
 * anything.
 */
// Per-IP rate limiting reads the client address, so Express has to be told how
// many proxies sit in front of it. 0 (the default) means none.
if (env_config_1.envConfig.trust_proxy > 0) {
    app.set("trust proxy", env_config_1.envConfig.trust_proxy);
}
// Security headers. `contentSecurityPolicy` is off because this process serves
// only JSON — a CSP governs what a *document* may load, and there is no
// document here. Leaving it on would ship a policy that protects nothing and
// confuses anyone reading the response headers.
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
}));
// CORS must come BEFORE the rate limiter. A 429 is still a cross-origin
// response: without the headers already attached, the browser reports it as an
// opaque CORS failure and the user is told the wrong thing.
app.use((0, cors_1.default)({
    credentials: true,
    origin: ["http://localhost:3000"],
}));
// Logging sits above everything it should see — including the webhook and any
// request the limiter rejects.
app.use((0, morgan_1.default)(env_config_1.envConfig.node_env === "production" ? "combined" : "dev", {
    // Health probes would otherwise dominate the log.
    // `originalUrl`, not `path`: morgan's skip runs on the response's
    // `finish` event, by which point a mounted router has rewritten
    // `req.path` to be relative to its mount point ("/" for /health).
    // `originalUrl` is never rewritten.
    skip: (req) => req.originalUrl.startsWith("/health"),
}));
// Probes live outside /api/v1 and above the rate limiter: an orchestrator
// polling health must never be throttled, or a busy instance gets restarted
// for looking unhealthy.
app.use("/health", health_route_1.healthRouter);
// MUST stay above express.json(): Stripe signature verification needs the raw
// request bytes. Serves POST /webhook and POST /webhook/stripe.
//
// It is also deliberately ABOVE `apiLimiter` and outside `/api/v1`, so Stripe's
// retries are never throttled — a dropped retry loses an order or leaves a
// refund unreconciled.
app.use("/webhook", payment_route_1.stripeWebhookRouter);
// Body cap. Without a limit a single request can buffer an arbitrary amount of
// memory. Nothing this API accepts is large: images go straight to Cloudinary
// and arrive here only as URLs.
app.use(express_1.default.json({ limit: env_config_1.envConfig.body_limit }));
// Scoped to /api/v1 so the webhook above stays exempt.
app.use("/api/v1", rateLimiter_1.apiLimiter, rootRouter_1.default);
app.use(notFoundRoute_1.notFoundRoute); // not found-route error
app.use(globalErrorHandler_1.globalErrorHandler); // global error handler
exports.default = app;
