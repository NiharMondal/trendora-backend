/* eslint-disable no-console */
import { prisma } from "@/config/db";
import { OrderStatus, PaymentMethod, RefundStatus } from "@/lib/prisma-client";
import { toNumber } from "./money";
import { sendEmailSafely } from "@/utils/sendEmail";
import {
	newOrderForSellerEmail,
	orderPlacedEmail,
	orderStatusEmail,
	payoutPaidEmail,
	refundProcessedEmail,
	vendorApplicationDecisionEmail,
} from "@/utils/email-templates";

/**
 * Who gets told what, and when.
 *
 * Services call one function from here and pass an id; this module does the
 * reading, picks the template and sends. Keeping it in one place stops every
 * service growing its own `include` tree and its own opinion about recipients.
 *
 * **Two rules, both absolute.**
 *
 * 1. **Never throw.** Every function is wrapped in `notify()`, which swallows
 *    everything — a failed lookup or an SMTP outage must never fail the request
 *    that triggered it. An order that is already committed is not un-placed
 *    because a confirmation email bounced.
 * 2. **Never call from inside a `$transaction`.** These read from the database
 *    and talk to an SMTP server; doing that inside a transaction holds it open
 *    across network round trips. Call them *after* the commit, the same
 *    reasoning that keeps the gateway call out of the refund transaction in
 *    `./refund.ts`.
 */

/** Runs `fn`, turning any failure into a log line. */
const notify = async (label: string, fn: () => Promise<void>): Promise<void> => {
	try {
		await fn();
	} catch (error) {
		console.error(
			`[notify] ${label} failed:`,
			error instanceof Error ? error.message : error,
		);
	}
};

const readableMethod = (method: PaymentMethod): string =>
	method === PaymentMethod.CASH_ON_DELIVERY ? "Cash on delivery" : "Card";

/**
 * Order placed: confirm to the buyer, and tell each store about its own parcel.
 *
 * Called after the order transaction commits — from both the COD path and the
 * Stripe webhook, so neither branch can be forgotten.
 */
export const notifyOrderPlaced = (orderId: string): Promise<void> =>
	notify(`order-placed ${orderId}`, async () => {
		const order = await prisma.order.findUnique({
			where: { id: orderId },
			include: {
				user: { include: { auth: { select: { email: true } } } },
				vendorOrders: {
					include: {
						items: true,
						vendor: {
							include: {
								owner: {
									include: {
										auth: { select: { email: true } },
									},
								},
							},
						},
					},
				},
			},
		});

		if (!order) return;

		const groups = order.vendorOrders.map((slice) => ({
			storeName: slice.vendor.storeName,
			items: slice.items.map(
				(i) =>
					`${i.productName} x${i.quantity} — $${toNumber(i.subtotal).toFixed(2)}`,
			),
			total: toNumber(slice.totalAmount),
		}));

		// 1. The buyer.
		if (order.user.auth?.email) {
			await sendEmailSafely({
				to: order.user.auth.email,
				...orderPlacedEmail({
					name: order.user.name,
					orderNumber: order.orderNumber,
					totalAmount: toNumber(order.totalAmount),
					paymentMethod: readableMethod(order.paymentMethod),
					groups,
				}),
			});
		}

		// 2. Each seller, about their slice only — never the whole order.
		for (const slice of order.vendorOrders) {
			const sellerEmail = slice.vendor.owner.auth?.email;
			if (!sellerEmail) continue;

			await sendEmailSafely({
				to: sellerEmail,
				...newOrderForSellerEmail({
					storeName: slice.vendor.storeName,
					orderNumber: order.orderNumber,
					parcelNumber: slice.vendorOrderNumber,
					items: slice.items.map(
						(i) =>
							`${i.productName} x${i.quantity} — $${toNumber(i.subtotal).toFixed(2)}`,
					),
					earning: toNumber(slice.vendorEarning),
				}),
			});
		}
	});

/**
 * A parcel changed state. Only SHIPPED, DELIVERED and CANCELED reach the buyer
 * — PROCESSING is an internal step and mailing it is noise.
 */
export const notifyVendorOrderStatusChanged = (
	vendorOrderId: string,
): Promise<void> =>
	notify(`vendor-order-status ${vendorOrderId}`, async () => {
		const slice = await prisma.vendorOrder.findUnique({
			where: { id: vendorOrderId },
			include: {
				vendor: { select: { storeName: true } },
				refund: { select: { id: true } },
				order: {
					include: {
						user: {
							include: { auth: { select: { email: true } } },
						},
					},
				},
			},
		});

		if (!slice) return;

		const status = slice.orderStatus;
		if (
			status !== OrderStatus.SHIPPED &&
			status !== OrderStatus.DELIVERED &&
			status !== OrderStatus.CANCELED
		) {
			return;
		}

		const email = slice.order.user.auth?.email;
		if (!email) return;

		await sendEmailSafely({
			to: email,
			...orderStatusEmail({
				name: slice.order.user.name,
				orderNumber: slice.order.orderNumber,
				parcelNumber: slice.vendorOrderNumber,
				storeName: slice.vendor.storeName,
				status,
				trackingNumber: slice.trackingNumber,
				carrier: slice.carrier,
				cancelReason: slice.cancelReason,
				// Only promise a refund when one actually exists. A cancelled
				// unpaid or COD parcel owes nothing, and saying otherwise would
				// have the buyer waiting for money that is not coming.
				refundExpected: Boolean(slice.refund),
			}),
		});
	});

/** A refund reached the buyer. Sent only on SUCCEEDED — money that really moved. */
export const notifyRefundProcessed = (refundId: string): Promise<void> =>
	notify(`refund-processed ${refundId}`, async () => {
		const refund = await prisma.refund.findUnique({
			where: { id: refundId },
			include: {
				order: {
					include: {
						user: {
							include: { auth: { select: { email: true } } },
						},
					},
				},
			},
		});

		if (!refund || refund.status !== RefundStatus.SUCCEEDED) return;

		const email = refund.order.user.auth?.email;
		if (!email) return;

		await sendEmailSafely({
			to: email,
			...refundProcessedEmail({
				name: refund.order.user.name,
				orderNumber: refund.order.orderNumber,
				amount: toNumber(refund.amount),
			}),
		});
	});

/** An admin approved or rejected a store application. */
export const notifyVendorApplicationDecision = (
	vendorId: string,
	approved: boolean,
): Promise<void> =>
	notify(`vendor-decision ${vendorId}`, async () => {
		const vendor = await prisma.vendor.findUnique({
			where: { id: vendorId },
			include: {
				owner: { include: { auth: { select: { email: true } } } },
			},
		});

		if (!vendor?.owner.auth?.email) return;

		await sendEmailSafely({
			to: vendor.owner.auth.email,
			...vendorApplicationDecisionEmail({
				name: vendor.owner.name,
				storeName: vendor.storeName,
				approved,
				rejectionReason: vendor.rejectionReason,
				storeUrl: approved
					? `${process.env.FRONTEND_URL ?? ""}/stores/${vendor.slug}`
					: undefined,
			}),
		});
	});

/** A payout was marked paid. */
export const notifyPayoutPaid = (payoutId: string): Promise<void> =>
	notify(`payout-paid ${payoutId}`, async () => {
		const payout = await prisma.payout.findUnique({
			where: { id: payoutId },
			include: {
				vendor: {
					include: {
						owner: {
							include: { auth: { select: { email: true } } },
						},
					},
				},
			},
		});

		if (!payout?.vendor.owner.auth?.email) return;

		await sendEmailSafely({
			to: payout.vendor.owner.auth.email,
			...payoutPaidEmail({
				name: payout.vendor.owner.name,
				storeName: payout.vendor.storeName,
				amount: toNumber(payout.amount),
				reference: payout.reference,
				method: payout.method,
			}),
		});
	});
