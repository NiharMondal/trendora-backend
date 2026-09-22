import { OrderStatus } from "@/lib/prisma-client";
import CustomError from "@/utils/customError";

/**
 * The fulfilment state machine. Applies to a VendorOrder — the parent Order's
 * status is derived from its slices (see deriveOrderStatus in ./order.ts) and
 * is never transitioned directly.
 */
export const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
	PENDING: [OrderStatus.PROCESSING, OrderStatus.CANCELED],
	PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELED],
	SHIPPED: [OrderStatus.DELIVERED, OrderStatus.CANCELED],
	DELIVERED: [],
	CANCELED: [],
};

/**
 * Transitions a VENDOR may perform on their own order.
 *
 * A vendor moves an order forward and may cancel while nothing has shipped.
 * Cancelling an already-shipped order is a refund dispute, so it is reserved
 * for an ADMIN — otherwise a vendor could cancel (and trigger a refund) on
 * goods the buyer has already received.
 */
const sellerAllowedTransitions: Record<OrderStatus, OrderStatus[]> = {
	PENDING: [OrderStatus.PROCESSING, OrderStatus.CANCELED],
	PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELED],
	SHIPPED: [OrderStatus.DELIVERED],
	DELIVERED: [],
	CANCELED: [],
};

/**
 * Transitions the BUYER may perform on a parcel of their own order.
 *
 * Cancel while the parcel is still PENDING, and nothing else. Once the seller
 * has accepted it and moved to PROCESSING they are packing real goods, so
 * calling it off stops being a unilateral decision and becomes a request —
 * the seller or an admin cancels it then.
 *
 * **The gate is the ORDER status, never the payment status.** A cash-on-delivery
 * order stays `paymentStatus: PENDING` right up until every parcel is delivered
 * (see `reconcilePayment`), so "payment is still pending" would let a buyer
 * cancel a COD parcel that has already shipped. Payment status decides what
 * *happens* on cancel — whether a refund is owed — not whether cancel is
 * allowed; `recordRefundIntent` handles that part.
 */
const buyerAllowedTransitions: Record<OrderStatus, OrderStatus[]> = {
	PENDING: [OrderStatus.CANCELED],
	PROCESSING: [],
	SHIPPED: [],
	DELIVERED: [],
	CANCELED: [],
};

/**
 * Which capacity the caller is acting in. This is NOT the same as their role:
 * a VENDOR is also a shopper, so the same account is a `seller` on its own
 * store's parcels and a `buyer` on parcels of orders it placed elsewhere.
 * Deciding from `Role` alone is what locked sellers out of cancelling their
 * own purchases.
 */
export type TActorCapacity = "admin" | "seller" | "buyer";

const transitionsByCapacity: Record<
	TActorCapacity,
	Record<OrderStatus, OrderStatus[]>
> = {
	admin: allowedTransitions,
	seller: sellerAllowedTransitions,
	buyer: buyerAllowedTransitions,
};

export function ensureTransitionAllowed(
	current: OrderStatus,
	next: OrderStatus,
) {
	const nexts = allowedTransitions[current] ?? [];
	if (!nexts.includes(next)) {
		throw new CustomError(
			400,
			`Invalid status transition: ${current} → ${next}`,
		);
	}
}

/**
 * As above, but also enforces what the caller's **capacity** permits.
 * ADMIN may perform any transition the state machine allows.
 */
export function ensureTransitionAllowedForActor(
	current: OrderStatus,
	next: OrderStatus,
	capacity: TActorCapacity,
) {
	ensureTransitionAllowed(current, next);

	if (capacity === "admin") return;

	const nexts = transitionsByCapacity[capacity][current] ?? [];
	if (!nexts.includes(next)) {
		if (capacity === "buyer") {
			// Be specific: "you cannot cancel now" is actionable, "forbidden"
			// is not. The buyer needs to know to contact the seller instead.
			throw new CustomError(
				403,
				next === OrderStatus.CANCELED
					? `This order can no longer be cancelled because the seller has already moved it to ${current}. Contact the seller to request a cancellation.`
					: `You cannot change an order from ${current} to ${next}.`,
			);
		}

		throw new CustomError(
			403,
			`A vendor cannot change an order from ${current} to ${next}. Contact support.`,
		);
	}
}
