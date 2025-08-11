import express, { Application, Request, Response } from "express";
import { rootRouter } from "./routes/rootRouter";
import { notFoundRoute } from "./middleware/notFoundRoute";
import { globalErrorHandler } from "./middleware/globalErrorHandler";

const app: Application = express();

app.use("/api/v1", rootRouter);

app.use("/", (req: Request, res: Response) => {
	res.json({ success: true, message: "Trendora is running" });
});
app.use(notFoundRoute); // not found-route error
app.use(globalErrorHandler); // global error handler

export default app;
