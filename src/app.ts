import express, { Application } from "express";
import cors from "cors";
import rootRouter from "./routes/rootRouter";
import { notFoundRoute } from "./middleware/notFoundRoute";
import { globalErrorHandler } from "./middleware/globalErrorHandler";
import { stripeWebhookRouter } from "./modules/payment/payment.route";

const app: Application = express();

// MUST stay above express.json(): Stripe signature verification needs the raw
// request bytes. Serves POST /webhook and POST /webhook/stripe.
app.use("/webhook", stripeWebhookRouter);

app.use(express.json());
app.use(
	cors({
		credentials: true,
		origin: ["http://localhost:3000"],
	}),
);
app.use("/api/v1", rootRouter);

// app.use("/", (req: Request, res: Response) => {
// 	res.json({ success: true, message: "Trendora is running" });
// });

app.use(notFoundRoute); // not found-route error
app.use(globalErrorHandler); // global error handler

export default app;
