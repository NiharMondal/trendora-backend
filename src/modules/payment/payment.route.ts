import { Router } from "express";
import express from "express";
import { paymentControllers } from "./payment.controller";
const router = Router();

export const createPaymentWithStripeWebhook = router.post(
	"/",
	express.raw({ type: "application/json" }),
	paymentControllers.createPaymentWithStripeWebhook
);
