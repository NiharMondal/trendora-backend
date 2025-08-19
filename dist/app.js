"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const rootRouter_1 = __importDefault(require("./routes/rootRouter"));
const notFoundRoute_1 = require("./middleware/notFoundRoute");
const globalErrorHandler_1 = require("./middleware/globalErrorHandler");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)({ credentials: true, origin: ["http://localhost:3000"] }));
app.use("/api/v1", rootRouter_1.default);
// app.use("/", (req: Request, res: Response) => {
// 	res.json({ success: true, message: "Trendora is running" });
// });
app.use(notFoundRoute_1.notFoundRoute); // not found-route error
app.use(globalErrorHandler_1.globalErrorHandler); // global error handler
exports.default = app;
