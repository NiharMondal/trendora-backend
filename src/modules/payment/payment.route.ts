import express, { Router } from "express";

import { Role } from "@/lib/prisma-client";
import { authGuard } from "@/middleware/authGuard";

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

/**
 * The READ side, and a completely separate router on purpose.
 *
 * `stripeWebhookRouter` above must be mounted at /webhook BEFORE
 * `express.json()`; this one must be mounted under /api/v1 AFTER it, like every
 * other resource. Putting both on one router would force one of them to be
 * wrong. Only this one belongs in `routes-array.ts`.
 *
 * Everything here is read-only. Payment state is owned by the gateway and
 * reconciled by the webhook and `reconcilePayment` — there is no endpoint that
 * lets a client set it, and there should not be.
 */
const readRouter = Router();

/** A buyer's own payments. A VENDOR is also a shopper, hence all three roles. */
readRouter.get(
    "/me",
    authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN),
    paymentControllers.findMine,
);

/**
 * The payment on one order, for its buyer or an ADMIN. A seller is not an
 * audience: one payment spans every store on the order, and what a seller
 * needs — has the buyer paid? — is already on their own parcel.
 */
readRouter.get(
    "/order/:orderId",
    authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN),
    paymentControllers.findByOrderId,
);

readRouter.get(
    "/admin/all",
    authGuard(Role.ADMIN),
    paymentControllers.findAllForAdmin,
);

// Last: a literal segment above must not be swallowed as an id.
readRouter.get("/:id", authGuard(Role.ADMIN), paymentControllers.findById);

export const paymentRouter = readRouter;
