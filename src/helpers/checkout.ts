import {
    CheckoutSessionStatus,
    PaymentMethod,
    Prisma,
} from "@/lib/prisma-client";
import { prisma } from "@/config/db";
import { envConfig } from "@/config/env-config";
import { OrderCalculation } from "@/types/common.types";
import CustomError from "@/utils/customError";

/**
 * Checkout drafts.
 *
 * A Stripe order is created by the webhook, not by the request that starts the
 * payment — so the priced cart has to survive in between. Stripe metadata
 * cannot carry it (50 keys, 500 chars per value, and a multi-vendor cart is far
 * bigger than that), so the calculation is persisted here and only the draft id
 * travels through Stripe.
 *
 * This is also what makes order creation idempotent: `consumeCheckoutSession`
 * flips the draft to COMPLETED inside the same transaction that creates the
 * order, so a replayed webhook finds nothing left to redeem.
 */

export type TCheckoutDraftInput = {
    orderNumber: string;
    userId: string;
    shippingAddressId: string;
    paymentMethod: PaymentMethod;
    calculation: OrderCalculation;
    notes?: string;
    ipAddress?: string;
    userAgent?: string;
};

export const createCheckoutSession = async (input: TCheckoutDraftInput) => {
    const expiresAt = new Date(
        Date.now() + envConfig.checkout_session_ttl_minutes * 60 * 1000,
    );

    return prisma.checkoutSession.create({
        data: {
            orderNumber: input.orderNumber,
            userId: input.userId,
            shippingAddressId: input.shippingAddressId,
            paymentMethod: input.paymentMethod,
            calculation: input.calculation as unknown as Prisma.InputJsonValue,
            amountTotal: input.calculation.totalAmount,
            notes: input.notes,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            expiresAt,
        },
    });
};

export const attachStripeSession = async (
    checkoutSessionId: string,
    stripeSessionId: string,
) =>
    prisma.checkoutSession.update({
        where: { id: checkoutSessionId },
        data: { stripeSessionId },
    });

/**
 * Claim a draft for order creation.
 *
 * Must run inside the same transaction as the order insert. The update is
 * conditional on `status = PENDING`, so two concurrent webhook deliveries
 * cannot both redeem it — the loser sees 0 rows updated and is told the draft
 * is already consumed.
 */
export const consumeCheckoutSession = async (
    tx: Prisma.TransactionClient,
    checkoutSessionId: string,
): Promise<{
    calculation: OrderCalculation;
    orderNumber: string;
    userId: string;
    shippingAddressId: string;
    notes: string | null;
    ipAddress: string | null;
    userAgent: string | null;
}> => {
    const draft = await tx.checkoutSession.findUnique({
        where: { id: checkoutSessionId },
    });

    if (!draft) {
        throw new CustomError(404, "Checkout session not found");
    }

    if (draft.status !== CheckoutSessionStatus.PENDING) {
        throw new CustomError(
            409,
            `Checkout session already ${draft.status.toLowerCase()}`,
        );
    }

    const claimed = await tx.checkoutSession.updateMany({
        where: { id: checkoutSessionId, status: CheckoutSessionStatus.PENDING },
        data: {
            status: CheckoutSessionStatus.COMPLETED,
            consumedAt: new Date(),
        },
    });

    if (claimed.count === 0) {
        throw new CustomError(409, "Checkout session already consumed");
    }

    return {
        calculation: draft.calculation as unknown as OrderCalculation,
        orderNumber: draft.orderNumber,
        userId: draft.userId,
        shippingAddressId: draft.shippingAddressId,
        notes: draft.notes,
        ipAddress: draft.ipAddress,
        userAgent: draft.userAgent,
    };
};

/**
 * Sweep drafts whose TTL has passed. Scheduled hourly by
 * `src/scheduler/index.ts`; expired drafts are harmless either way, because
 * `consumeCheckoutSession` also refuses anything not PENDING.
 */
export const expireStaleCheckoutSessions = async () =>
    prisma.checkoutSession.updateMany({
        where: {
            status: CheckoutSessionStatus.PENDING,
            expiresAt: { lt: new Date() },
        },
        data: { status: CheckoutSessionStatus.EXPIRED },
    });
