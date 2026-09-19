import express, { Router } from "express";
import { paymentControllers } from "./payment.controller";

const router = Router();

/**
 * Stripe signature verification needs the EXACT bytes Stripe signed, so this
 * router parses the body as a raw Buffer and is mounted in `app.ts` **before**
 * `express.json()`. Mounting it anywhere after that would let `express.json()`
 * consume the stream first, and every signature check would fail.
 */
const rawBody = express.raw({ type: "application/json" });

/**
 * Both paths serve the same handler.
 *
 * `POST /webhook` is the documented, conventional single endpoint — and it
 * previously 404'd, because this router only declared `/stripe`. Anyone
 * configuring Stripe from the docs would have had every event rejected, so no
 * Stripe order would ever have been created.
 *
 * `/webhook/stripe` is kept so an endpoint already pointed at it keeps working.
 */
router.post("/", rawBody, paymentControllers.createPaymentWithStripeWebhook);
router.post(
    "/stripe",
    rawBody,
    paymentControllers.createPaymentWithStripeWebhook,
);

export const stripeWebhookRouter = router;
