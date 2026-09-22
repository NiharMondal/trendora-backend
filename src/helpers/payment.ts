import { Payment, Refund } from "@/lib/prisma-client";

/**
 * Who is asking. Not the same as role: a VENDOR is also a shopper, so the same
 * account is the `buyer` on an order it placed and a `seller` on an order it
 * merely has a parcel in — the same distinction `resolveOrderActorCapacity`
 * draws for fulfilment.
 */
export type TPaymentAudience = "admin" | "buyer" | "seller";

/**
 * `Payment.gatewayResponse` holds the **entire Stripe Checkout Session**. That
 * object carries `customer_details` — the buyer's name, email, phone and
 * billing address — alongside every internal gateway id. `Refund
 * .gatewayResponse` is the same for a Stripe refund, and `idempotencyKey` is
 * ours, not something a client has any use for.
 *
 * It has to be narrowed by caller rather than simply dropped, because the admin
 * refund queue is exactly where that blob is worth having. This is the same
 * shape of fix as `sanitizeStatusHistory`: one endpoint, three audiences, and
 * the raw row only for the one that investigates problems.
 */
export const sanitizePayment = (
    payment: Payment,
    audience: TPaymentAudience,
) => {
    if (audience === "admin") return payment;

    const { gatewayResponse: _gatewayResponse, ...visible } = payment;

    if (audience === "buyer") return visible;

    // A seller is told whether the buyer has paid, and nothing else. `amount`
    // and `refundAmount` describe the whole basket across every store on the
    // order — the same reason `getOrderById` blanks the order's money fields
    // for a vendor.
    return {
        method: payment.method,
        status: payment.status,
        paidAt: payment.paidAt,
    };
};

/** As above. A seller sees refunds on their own parcels, never the gateway blob. */
export const sanitizeRefund = (refund: Refund, isAdmin: boolean) => {
    if (isAdmin) return refund;

    const {
        gatewayResponse: _gatewayResponse,
        idempotencyKey: _idempotencyKey,
        ...visible
    } = refund;

    return visible;
};

/**
 * What a buyer may read of their own payment through `/payments`.
 *
 * Spelled out as a `select` rather than reusing `sanitizePayment` so the blob
 * is never loaded in the first place: these endpoints have no admin branch, and
 * a projection that cannot return a field cannot regress into returning it.
 */
export const buyerPaymentSelect = {
    id: true,
    orderId: true,
    amount: true,
    method: true,
    status: true,
    // The Stripe payment-intent id. Safe to show and the one reference a buyer
    // can quote to support; `gatewayResponse` is what must not travel.
    transactionId: true,
    paymentGateway: true,
    // Stripe's own decline message ("Your card was declined"), written from
    // `last_payment_error.message` — buyer-facing text by construction.
    failureReason: true,
    paidAt: true,
    refundedAt: true,
    refundAmount: true,
    createdAt: true,
    updatedAt: true,
} as const;
