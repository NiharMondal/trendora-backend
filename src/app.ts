import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rootRouter from "./routes/rootRouter";
import { notFoundRoute } from "./middleware/notFoundRoute";
import { globalErrorHandler } from "./middleware/globalErrorHandler";
import { stripeWebhookRouter } from "./modules/payment/payment.route";
import { apiLimiter } from "./middleware/rateLimiter";
import { envConfig } from "./config/env-config";

const app: Application = express();

/**
 * Middleware order here is load-bearing. Read the comments before moving
 * anything.
 */

// Per-IP rate limiting reads the client address, so Express has to be told how
// many proxies sit in front of it. 0 (the default) means none.
if (envConfig.trust_proxy > 0) {
	app.set("trust proxy", envConfig.trust_proxy);
}

// Security headers. `contentSecurityPolicy` is off because this process serves
// only JSON — a CSP governs what a *document* may load, and there is no
// document here. Leaving it on would ship a policy that protects nothing and
// confuses anyone reading the response headers.
app.use(
	helmet({
		contentSecurityPolicy: false,
	}),
);

// CORS must come BEFORE the rate limiter. A 429 is still a cross-origin
// response: without the headers already attached, the browser reports it as an
// opaque CORS failure and the user is told the wrong thing.
app.use(
	cors({
		credentials: true,
		origin: ["http://localhost:3000"],
	}),
);

// Logging sits above everything it should see — including the webhook and any
// request the limiter rejects.
app.use(
	morgan(envConfig.node_env === "production" ? "combined" : "dev", {
		// Health probes would otherwise dominate the log.
		skip: (req) => req.path === "/health",
	}),
);

// MUST stay above express.json(): Stripe signature verification needs the raw
// request bytes. Serves POST /webhook and POST /webhook/stripe.
//
// It is also deliberately ABOVE `apiLimiter` and outside `/api/v1`, so Stripe's
// retries are never throttled — a dropped retry loses an order or leaves a
// refund unreconciled.
app.use("/webhook", stripeWebhookRouter);

// Body cap. Without a limit a single request can buffer an arbitrary amount of
// memory. Nothing this API accepts is large: images go straight to Cloudinary
// and arrive here only as URLs.
app.use(express.json({ limit: envConfig.body_limit }));

// Scoped to /api/v1 so the webhook above stays exempt.
app.use("/api/v1", apiLimiter, rootRouter);

app.use(notFoundRoute); // not found-route error
app.use(globalErrorHandler); // global error handler

export default app;
