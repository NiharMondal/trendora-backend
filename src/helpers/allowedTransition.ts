import { OrderStatus, Role } from "@/lib/prisma-client";
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
const vendorAllowedTransitions: Record<OrderStatus, OrderStatus[]> = {
	PENDING: [OrderStatus.PROCESSING, OrderStatus.CANCELED],
	PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELED],
	SHIPPED: [OrderStatus.DELIVERED],
	DELIVERED: [],
	CANCELED: [],
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
 * As above, but also enforces what the caller's role is permitted to do.
 * ADMIN may perform any transition the state machine allows.
 */
export function ensureTransitionAllowedForRole(
	current: OrderStatus,
	next: OrderStatus,
	role: string,
) {
	ensureTransitionAllowed(current, next);

	if (role === Role.ADMIN) return;

	const nexts = vendorAllowedTransitions[current] ?? [];
	if (!nexts.includes(next)) {
		throw new CustomError(
			403,
			`A vendor cannot change an order from ${current} to ${next}. Contact support.`,
		);
	}
}
