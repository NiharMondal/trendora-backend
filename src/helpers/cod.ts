import {
	OrderStatus,
	PaymentMethod,
	PaymentStatus,
} from "../../generated/prisma";
import { prisma } from "../config/db";
import { OrderCalculation } from "../types/common.types";
import { persistOrder } from "./create-order";

/**
 * Cash on delivery: the order is created inline, unpaid. Payment flips to PAID
 * when the last vendor order is delivered (see the order service).
 */
export async function createCODOrder(input: {
	userId: string;
	shippingAddressId: string;
	calculation: OrderCalculation;
	orderNumber: string;
	notes?: string;
	ipAddress?: string;
	userAgent?: string;
}) {
	return prisma.$transaction(async (tx) =>
		persistOrder(tx, {
			orderNumber: input.orderNumber,
			userId: input.userId,
			shippingAddressId: input.shippingAddressId,
			calculation: input.calculation,
			paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
			paymentStatus: PaymentStatus.PENDING,
			initialVendorStatus: OrderStatus.PENDING,
			notes: input.notes,
			ipAddress: input.ipAddress,
			userAgent: input.userAgent,
		}),
	);
}
