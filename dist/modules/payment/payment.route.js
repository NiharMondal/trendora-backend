"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRouter = exports.createPaymentWithStripeWebhook = void 0;
const express_1 = require("express");
const express_2 = __importDefault(require("express"));
const payment_controller_1 = require("./payment.controller");
const router = (0, express_1.Router)();
exports.createPaymentWithStripeWebhook = router.post("/stripe", express_2.default.raw({ type: "application/json" }), payment_controller_1.paymentControllers.createPaymentWithStripeWebhook);
exports.paymentRouter = router;
