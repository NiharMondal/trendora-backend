"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhookRouter = void 0;
const express_1 = __importStar(require("express"));
const payment_controller_1 = require("./payment.controller");
const router = (0, express_1.Router)();
/**
 * Stripe signature verification needs the EXACT bytes Stripe signed, so this
 * router parses the body as a raw Buffer and is mounted in `app.ts` **before**
 * `express.json()`. Mounting it anywhere after that would let `express.json()`
 * consume the stream first, and every signature check would fail.
 */
const rawBody = express_1.default.raw({ type: "application/json" });
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
router.post("/", rawBody, payment_controller_1.paymentControllers.createPaymentWithStripeWebhook);
router.post("/stripe", rawBody, payment_controller_1.paymentControllers.createPaymentWithStripeWebhook);
exports.stripeWebhookRouter = router;
