import { OrderStatus } from "../../generated/prisma";

export const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
	PENDING: [OrderStatus.PROCESSING, OrderStatus.CANCELED],
	PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELED],
	SHIPPED: [OrderStatus.DELIVERED, OrderStatus.CANCELED],
	DELIVERED: [],
	CANCELED: [],
};

export function ensureTransitionAllowed(
	current: OrderStatus,
	next: OrderStatus
) {
	const nexts = allowedTransitions[current] ?? [];
	if (!nexts.includes(next)) {
		throw new Error(`Invalid transition: ${current} → ${next}`);
	}
}
