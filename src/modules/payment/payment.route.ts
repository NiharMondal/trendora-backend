import { Router } from "express";
import express from "express";
import { paymentControllers } from "./payment.controller";
const router = Router();

export const createPaymentWithStripeWebhook = router.post(
	"/stripe",
	express.raw({ type: "application/json" }),
	paymentControllers.createPaymentWithStripeWebhook
);

export const paymentRouter = router;
