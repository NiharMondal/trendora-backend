import express, { Application } from "express";
import cors from "cors";
import rootRouter from "./routes/rootRouter";
import { notFoundRoute } from "./middleware/notFoundRoute";
import { globalErrorHandler } from "./middleware/globalErrorHandler";
import {
	createPaymentWithSSL,
	createPaymentWithStripeWebhook,
} from "./modules/payment/payment.route";

const app: Application = express();

app.use("/webhook", createPaymentWithStripeWebhook);
app.use("/validate", createPaymentWithSSL);

app.use(express.json());
app.use(cors({ credentials: true, origin: ["http://localhost:3000"] }));
app.use("/api/v1", rootRouter);

// app.use("/", (req: Request, res: Response) => {
// 	res.json({ success: true, message: "Trendora is running" });
// });
app.use(notFoundRoute); // not found-route error
app.use(globalErrorHandler); // global error handler

export default app;
