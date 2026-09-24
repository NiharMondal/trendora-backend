import {
	OrderStatus,
	PaymentMethod,
	PaymentStatus,
	Prisma,
	RefundStatus,
	Role,
} from "@/lib/prisma-client";
import { prisma } from "@/config/db";
import {
	ensureTransitionAllowedForActor,
	type TActorCapacity,
} from "@/helpers/allowedTransition";
import PrismaQueryBuilder from "@/lib/PrismaQueryBuilder";
import CustomError from "@/utils/customError";
import { createStripePaymentUrl } from "@/helpers/stripe";
import {
	generateOrderNumber,
	logStatusChange,
	recalculateOrderRollup,
	validateAndCalculateOrder,
} from "@/helpers/order";
import { createCODOrder } from "@/helpers/cod";
import {
	attachStripeSession,
	createCheckoutSession,
} from "@/helpers/checkout";
import { round2, toNumber } from "@/helpers/money";
import { processRefund, recordRefundIntent } from "@/helpers/refund";
import {
	notifyRefundProcessed,
	notifyVendorOrderStatusChanged,
} from "@/helpers/notifications";
import {
	assertVendorOwnsVendorOrder,
	publicProductFilter,
	requireApprovedVendor,
} from "@/helpers/vendor";
import { sanitizePayment, sanitizeRefund } from "@/helpers/payment";
import { TCreateOrderSchema, TUpdateVendorOrderStatus } from "./order.validation";

export type TBasicInfo = {
	userId: string;
	ipAddress: string;
	userAgent: string;
};

type TActor = { id: string; role: string };

/** Store identity shown next to each slice of an order. */
/**
 * What `OrderStatusHistory` may leave the server as.
 *
 * The rows carry `ipAddress` and the acting `userId`. Both endpoints that
 * return history are reachable by the **buyer and by any vendor with a slice**
 * of the order, so returning the raw row let a seller read the buyer's IP
 * address off their own order — and let a buyer read the seller's. The trail is
 * fetched with everything and then narrowed per caller.
 */
const statusHistorySelect = {
	id: true,
	oldStatus: true,
	newStatus: true,
	note: true,
	createdAt: true,
	ipAddress: true,
	user: { select: { id: true, name: true } },
} satisfies Prisma.OrderStatusHistorySelect;

type TRawStatusHistory = {
	id: string;
	oldStatus: OrderStatus;
	newStatus: OrderStatus;
	note: string | null;
	createdAt: Date;
	ipAddress: string | null;
	user: { id: string; name: string } | null;
};

/**
 * Everyone sees the timeline; only an ADMIN sees who did it and from where.
 *
 * A buyer does not need the seller's personal name (the store name is already
 * on the parcel), a seller does not need the buyer's, and nobody outside the
 * platform needs an IP address — that field exists for abuse investigation,
 * which is an admin activity.
 */
const sanitizeStatusHistory = (
	history: TRawStatusHistory[],
	isAdmin: boolean,
) =>
	history.map(({ ipAddress, user, ...event }) =>
		isAdmin ? { ...event, ipAddress, actor: user } : event,
	);

const vendorCardSelect = {
	id: true,
	storeName: true,
	slug: true,
	logo: true,
} satisfies Prisma.VendorSelect;

/**
 * Place an order.
 *
 * The cart is priced and split by vendor server-side. For STRIPE no order row
 * is written here — the priced split is persisted as a CheckoutSession and the
 * order is created by the webhook once the charge succeeds. COD creates the
 * order inline.
 */
const createOrder = async (payload: TCreateOrderSchema & TBasicInfo) => {
	// 1. Validate user exists
	const user = await prisma.user.findUnique({
		where: { id: payload.userId },
	});
	if (!user) {
		throw new CustomError(404, "User not found");
	}

	// 2. Resolve shipping address
	let shippingAddress;

	if (payload.shippingAddressId) {
		// Use existing address — validate it belongs to the user
		shippingAddress = await prisma.address.findFirst({
			where: {
				id: payload.shippingAddressId,
				userId: payload.userId,
				isDeleted: false,
			},
		});

		if (!shippingAddress) {
			throw new CustomError(
				404,
				"Shipping address not found or does not belong to user",
			);
		}
	} else if (payload.address) {
		// Create a new address on the fly
		shippingAddress = await prisma.address.create({
			data: {
				userId: payload.userId,
				fullName: payload.address.fullName,
				email: payload.address.email,
				phone: payload.address.phone,
				street: payload.address.street,
				city: payload.address.city,
				state: payload.address.state,
				postalCode: payload.address.postalCode,
				country: payload.address.country,
			},
		});
	} else {
		throw new CustomError(
			400,
			"Either shippingAddressId or address fields are required",
		);
	}

	// 3. Price the cart from the database, grouped by vendor (SECURE — never
	//    trusts client prices, and rejects items from suspended stores).
	const calculation = await validateAndCalculateOrder(payload.items);

	// 4. Generate unique order number
	const orderNumber = await generateOrderNumber();

	// 5. Handle payment method specific logic
	if (payload.paymentMethod === PaymentMethod.STRIPE) {
		// Persist the priced split first: the webhook, not this request,
		// creates the order, and Stripe metadata is far too small to carry a
		// multi-vendor cart.
		const draft = await createCheckoutSession({
			orderNumber,
			userId: payload.userId,
			shippingAddressId: shippingAddress.id,
			paymentMethod: PaymentMethod.STRIPE,
			calculation,
			notes: payload.notes,
			ipAddress: payload.ipAddress,
			userAgent: payload.userAgent,
		});

		const { url, stripeSessionId } = await createStripePaymentUrl({
			userId: payload.userId,
			checkoutSessionId: draft.id,
			orderNumber,
			calculation,
		});

		await attachStripeSession(draft.id, stripeSessionId);

		return {
			paymentUrl: url,
			orderNumber,
			// The per-vendor breakdown, so the frontend can show what each
			// store charges without recomputing it.
			vendors: calculation.vendors.map(summariseVendorGroup),
			totalAmount: calculation.totalAmount,
		};
	} else if (payload.paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
		// For COD, create order immediately
		const order = await createCODOrder({
			userId: payload.userId,
			shippingAddressId: shippingAddress.id,
			calculation,
			orderNumber,
			notes: payload.notes,
			ipAddress: payload.ipAddress,
			userAgent: payload.userAgent,
		});

		return { order, paymentUrl: null };
	} else {
		throw new CustomError(400, "Invalid payment method");
	}
};

const summariseVendorGroup = (vendor: {
	vendorId: string;
	storeName: string;
	vendorSlug: string;
	subtotal: number;
	tax: number;
	shippingCost: number;
	totalAmount: number;
	items: unknown[];
}) => ({
	vendorId: vendor.vendorId,
	storeName: vendor.storeName,
	slug: vendor.vendorSlug,
	subtotal: vendor.subtotal,
	tax: vendor.tax,
	shippingCost: vendor.shippingCost,
	totalAmount: vendor.totalAmount,
	itemCount: vendor.items.length,
});

/**
 * All orders, platform-wide. ADMIN only.
 */
const findAllFromDB = async (query: Record<string, unknown>) => {
	const builder = new PrismaQueryBuilder<Prisma.OrderWhereInput>(query, { model: "Order" });

	const prismaArgs = builder
		// Order number, or the buyer by name or email.
		.search(["orderNumber"], ["user.name", "user.auth.email"])
		.filter()
		.paginate()
		.sort("createdAt", "desc")
		.include({
			user: {
				select: {
					id: true,
					name: true,
					avatar: true,
					auth: {
						select: {
							email: true,
						},
					},
				},
			},
			vendorOrders: {
				select: {
					id: true,
					vendorOrderNumber: true,
					orderStatus: true,
					totalAmount: true,
					vendorEarning: true,
					commissionAmount: true,
					vendor: { select: vendorCardSelect },
				},
			},
		})
		.build();

	const [orders, meta] = await Promise.all([
		prisma.order.findMany(prismaArgs),
		builder.getMeta(prisma.order),
	]);

	return { meta, orders };
};

/**
 * A buyer's own orders, each with its per-vendor slices so the UI can show
 * "shipped by Store A, still processing at Store B".
 */
const getMyOrders = async (userId: string, query: Record<string, unknown>) => {
	const builder = new PrismaQueryBuilder<Prisma.OrderWhereInput>(query, { model: "Order" });

	const prismaArgs = builder
		.addWhere({ userId })
		// The buyer's own orders, so the order number is the only useful key
		// (the per-store parcels are a to-many relation `search` cannot walk).
		.search(["orderNumber"])
		.filter()
		.paginate()
		.sort()
		.include({
			vendorOrders: {
				include: {
					vendor: { select: vendorCardSelect },
					// So the buyer can see "cancelled — refunded" versus
					// "cancelled — refund pending".
					refund: {
						select: {
							id: true,
							amount: true,
							status: true,
							processedAt: true,
						},
					},
					items: {
						include: {
							product: {
								select: {
									id: true,
									name: true,
									slug: true,
									images: {
										where: { isMain: true },
										select: { url: true },
									},
								},
							},
						},
					},
				},
			},
			payment: {
				select: {
					status: true,
					method: true,
					paidAt: true,
					refundAmount: true,
					refundedAt: true,
				},
			},
		})
		.build();

	const [orders, meta] = await Promise.all([
		prisma.order.findMany(prismaArgs),
		builder.getMeta(prisma.order),
	]);

	return { orders, meta };
};

/**
 * A single order.
 *
 * Authorisation is by relationship, not just role: the buyer who placed it, an
 * ADMIN, or a VENDOR who has a slice of it. A vendor's view is filtered down to
 * their own slice — they must not see what the buyer bought from competitors.
 */
const getOrderById = async (orderId: string, actor: TActor) => {
	const order = await prisma.order.findUnique({
		where: { id: orderId },
		include: {
			vendorOrders: {
				include: {
					vendor: { select: vendorCardSelect },
					items: {
						include: {
							product: {
								select: {
									id: true,
									name: true,
									slug: true,
									images: {
										where: { isMain: true },
										select: { url: true },
									},
								},
							},
						},
					},
					statusHistory: {
						select: statusHistorySelect,
						orderBy: { createdAt: "asc" },
					},
					// Whether the money for a cancelled parcel actually went
					// back — a cancelled parcel with a FAILED refund is a
					// buyer who has not been paid.
					refund: true,
				},
			},
			payment: true,
			refunds: { orderBy: { createdAt: "desc" } },
			shippingAddress: true,
			user: {
				select: {
					id: true,
					name: true,
					auth: {
						select: {
							email: true,
						},
					},
				},
			},
		},
	});

	if (!order) {
		throw new CustomError(404, "Order not found");
	}

	const isAdmin = actor.role === Role.ADMIN;

	/**
	 * Re-attach each parcel's history and refund, narrowed for this caller.
	 *
	 * `refund` is the raw row, which carries `gatewayResponse` and our
	 * `idempotencyKey` — gateway internals nobody outside the platform needs.
	 */
	const withSafeSlices = (slices: typeof order.vendorOrders) =>
		slices.map((slice) => ({
			...slice,
			statusHistory: sanitizeStatusHistory(slice.statusHistory, isAdmin),
			refund: slice.refund
				? sanitizeRefund(slice.refund, isAdmin)
				: slice.refund,
		}));

	if (isAdmin) {
		return { ...order, vendorOrders: withSafeSlices(order.vendorOrders) };
	}

	if (order.userId === actor.id) {
		return {
			...order,
			vendorOrders: withSafeSlices(order.vendorOrders),
			payment: order.payment && sanitizePayment(order.payment, "buyer"),
			refunds: order.refunds.map((refund) =>
				sanitizeRefund(refund, false),
			),
		};
	}

	if (actor.role === Role.VENDOR) {
		const vendor = await requireApprovedVendor(actor.id);
		const mine = order.vendorOrders.filter(
			(vendorOrder) => vendorOrder.vendorId === vendor.id,
		);

		if (mine.length === 0) {
			throw new CustomError(404, "Order not found");
		}

		const mineIds = new Set(mine.map((slice) => slice.id));

		// Narrow to this vendor's slice, and drop the money fields that
		// describe the whole basket.
		return {
			...order,
			vendorOrders: withSafeSlices(mine),
			// One payment covers every store on this order, so a seller is
			// told only whether the buyer paid — never the basket total, and
			// never the Stripe session, which carries the buyer's billing
			// address.
			payment: order.payment && sanitizePayment(order.payment, "seller"),
			// Order-level refunds include other stores' parcels. A seller sees
			// refunds against their own slices and nothing else.
			refunds: order.refunds
				.filter(
					(refund) =>
						refund.vendorOrderId !== null &&
						mineIds.has(refund.vendorOrderId),
				)
				.map((refund) => sanitizeRefund(refund, false)),
			subtotal: undefined,
			tax: undefined,
			shippingCost: undefined,
			discount: undefined,
			totalAmount: undefined,
		};
	}

	throw new CustomError(403, "Not authorized to view this order");
};

// ---------------------------------------------------------------- vendor views

/**
 * The vendor's order queue — their slices only, never the parent orders.
 */
const getMyVendorOrders = async (
	actor: TActor,
	query: Record<string, unknown>,
) => {
	const scope =
		actor.role === Role.ADMIN && query.vendorId
			? { vendorId: String(query.vendorId) }
			: { vendorId: (await requireApprovedVendor(actor.id)).id };

	const { vendorId: _ignored, ...rest } = query;

	const builder = new PrismaQueryBuilder<Prisma.VendorOrderWhereInput>(rest, { model: "VendorOrder" });

	const prismaArgs = builder
		.withDefaultFilter(scope)
		// The parcel's own number and tracking, its order's number, or the
		// buyer — ANDed with `scope`, so a store only ever searches its own.
		.search(
			["vendorOrderNumber", "trackingNumber"],
			["order.orderNumber", "order.user.name"],
		)
		.filter()
		.paginate()
		.sort("createdAt", "desc")
		.include({
			items: true,
			order: {
				select: {
					id: true,
					orderNumber: true,
					paymentMethod: true,
					paymentStatus: true,
					createdAt: true,
					shippingSnapshot: true,
					user: { select: { id: true, name: true, phone: true } },
				},
			},
		})
		.build();

	const [vendorOrders, meta] = await Promise.all([
		prisma.vendorOrder.findMany(prismaArgs),
		builder.getMeta(prisma.vendorOrder),
	]);

	return { meta, vendorOrders };
};

const getVendorOrderById = async (actor: TActor, vendorOrderId: string) => {
	if (actor.role !== Role.ADMIN) {
		const vendor = await requireApprovedVendor(actor.id);
		await assertVendorOwnsVendorOrder(vendor.id, vendorOrderId);
	}

	const vendorOrder = await prisma.vendorOrder.findUnique({
		where: { id: vendorOrderId },
		include: {
			vendor: { select: vendorCardSelect },
			items: {
				include: {
					product: {
						select: {
							id: true,
							name: true,
							slug: true,
							images: {
								where: { isMain: true },
								select: { url: true },
							},
						},
					},
				},
			},
			statusHistory: {
				select: statusHistorySelect,
				orderBy: { createdAt: "asc" },
			},
			order: {
				select: {
					id: true,
					orderNumber: true,
					paymentMethod: true,
					paymentStatus: true,
					notes: true,
					createdAt: true,
					shippingSnapshot: true,
					user: { select: { id: true, name: true, phone: true } },
				},
			},
		},
	});

	if (!vendorOrder) {
		throw new CustomError(404, "Order not found");
	}

	// Vendor-facing, so the seller must not read the buyer's IP off their own
	// parcel's trail. Admins keep the full audit view.
	return {
		...vendorOrder,
		statusHistory: sanitizeStatusHistory(
			vendorOrder.statusHistory,
			actor.role === Role.ADMIN,
		),
	};
};

/**
 * Advance one vendor order through the fulfilment state machine.
 *
 * This is the only place VendorOrder.orderStatus is written, and every write
 * is followed by `recalculateOrderRollup` so the parent order's derived status
 * and totals stay consistent. A VENDOR may only move their own slice, and only
 * through the transitions their role permits.
 */
/**
 * Works out what the caller is to this particular parcel, and 404s if they are
 * nothing to it.
 *
 * Seller is checked before buyer so the existing vendor behaviour — including
 * the precise "your store is pending/rejected/suspended" errors from
 * `requireApprovedVendor` — is preserved exactly. A vendor who bought from
 * their own store resolves as the seller, which is strictly more permissive and
 * harmless: it is their own store and their own money.
 */
const resolveOrderActorCapacity = async (
	actor: TActor,
	vendorOrderId: string,
): Promise<TActorCapacity> => {
	if (actor.role === Role.ADMIN) {
		return "admin";
	}

	const vendorOrder = await prisma.vendorOrder.findUnique({
		where: { id: vendorOrderId },
		select: {
			vendorId: true,
			order: { select: { userId: true } },
		},
	});

	if (!vendorOrder) {
		throw new CustomError(404, "Order not found");
	}

	// Does this caller own the STORE that is shipping this parcel?
	const ownsSellingStore = await prisma.vendor.findFirst({
		where: {
			id: vendorOrder.vendorId,
			ownerId: actor.id,
			isDeleted: false,
		},
		select: { id: true },
	});

	if (ownsSellingStore) {
		// Re-runs the approval check so a suspended store still gets the
		// specific message rather than falling through to a bare 404.
		const vendor = await requireApprovedVendor(actor.id);
		await assertVendorOwnsVendorOrder(vendor.id, vendorOrderId);
		return "seller";
	}

	// Otherwise: is this a parcel of an order they placed?
	if (vendorOrder.order.userId === actor.id) {
		return "buyer";
	}

	// Neither. 404 rather than 403, so another user's order ids stay
	// unguessable — the convention used throughout `src/helpers/vendor.ts`.
	throw new CustomError(404, "Order not found");
};

const defaultCancelReason = (capacity: TActorCapacity): string => {
	if (capacity === "buyer") return "Canceled by customer";
	if (capacity === "admin") return "Canceled by admin";
	return "Canceled by seller";
};

const updateVendorOrderStatus = async (
	actor: TActor,
	vendorOrderId: string,
	payload: TUpdateVendorOrderStatus,
	ipAddress?: string,
) => {
	const newStatus = payload.orderStatus;

	// Ownership check happens outside the transaction so a 404 for someone
	// else's order costs nothing.
	//
	// Capacity, not role. The same account can be the seller of one parcel and
	// the buyer of another — a VENDOR is still a shopper — so this asks "what is
	// this caller to THIS parcel?" rather than reading `actor.role`.
	const capacity = await resolveOrderActorCapacity(actor, vendorOrderId);

	// The gateway call must NOT happen inside the transaction — it would hold
	// the transaction open across a network round trip, and a rollback after
	// Stripe had already moved money would leave a refund with no record of
	// it. So the transaction records the intent and returns its id, and the
	// refund is sent once the cancellation has actually committed.
	const { result, refundId } = await prisma.$transaction(async (tx) => {
		const vendorOrder = await tx.vendorOrder.findUnique({
			where: { id: vendorOrderId },
			include: {
				items: true,
				order: { include: { payment: true } },
			},
		});

		if (!vendorOrder) {
			throw new CustomError(404, "Order not found");
		}

		const previousStatus = vendorOrder.orderStatus;

		// 1. State machine + what this capacity may do
		ensureTransitionAllowedForActor(previousStatus, newStatus, capacity);

		const order = vendorOrder.order;
		const isStripe = order.paymentMethod === PaymentMethod.STRIPE;

		// 2. A prepaid order must actually be paid before it moves goods.
		if (
			isStripe &&
			order.paymentStatus !== PaymentStatus.PAID &&
			(newStatus === OrderStatus.SHIPPED ||
				newStatus === OrderStatus.DELIVERED)
		) {
			throw new CustomError(
				400,
				"Cannot ship or deliver until payment is completed",
			);
		}

		// 3. Cancelling returns this slice's stock — and only this slice's.
		if (newStatus === OrderStatus.CANCELED) {
			for (const item of vendorOrder.items) {
				if (item.variantId) {
					await tx.productVariant.update({
						where: { id: item.variantId },
						data: { stock: { increment: item.quantity } },
					});
				} else {
					await tx.product.update({
						where: { id: item.productId },
						data: {
							stockQuantity: { increment: item.quantity },
						},
					});
				}
			}
		}

		// 4. Write the slice
		const now = new Date();

		await tx.vendorOrder.update({
			where: { id: vendorOrderId },
			data: {
				orderStatus: newStatus,
				// Shipping details are the seller's to set; ignore them if a
				// buyer sends them along with a cancel.
				trackingNumber:
					capacity === "buyer"
						? undefined
						: (payload.trackingNumber ?? undefined),
				carrier:
					capacity === "buyer"
						? undefined
						: (payload.carrier ?? undefined),
				cancelReason:
					newStatus === OrderStatus.CANCELED
						? (payload.cancelReason ??
							defaultCancelReason(capacity))
						: undefined,
				shippedAt: newStatus === OrderStatus.SHIPPED ? now : undefined,
				deliveredAt:
					newStatus === OrderStatus.DELIVERED ? now : undefined,
				canceledAt:
					newStatus === OrderStatus.CANCELED ? now : undefined,
			},
		});

		await logStatusChange(tx, {
			orderId: order.id,
			vendorOrderId,
			oldStatus: previousStatus,
			newStatus,
			userId: actor.id,
			note:
				newStatus === OrderStatus.CANCELED
					? (payload.cancelReason ??
						defaultCancelReason(capacity))
					: undefined,
			ipAddress,
		});

		// 5. Roll the parent order's derived status and totals forward.
		await recalculateOrderRollup(tx, order.id);

		// 6. Reconcile the single payment row against the new slice states.
		await reconcilePayment(tx, order.id);

		// 7. A cancelled parcel of a paid order owes the buyer money. Record
		//    that in the same transaction as the cancellation — either both
		//    happen or neither does — and send it to the gateway after commit.
		//    Returns null for the cases with nothing to refund (unpaid order,
		//    cash on delivery, parcel already refunded).
		let pendingRefundId: string | null = null;

		if (newStatus === OrderStatus.CANCELED) {
			pendingRefundId = await recordRefundIntent(tx, {
				orderId: order.id,
				vendorOrderId,
				amount: toNumber(vendorOrder.totalAmount),
				reason:
					payload.cancelReason ??
					`Parcel ${vendorOrder.vendorOrderNumber} cancelled`,
			});
		}

		const updated = await tx.vendorOrder.findUniqueOrThrow({
			where: { id: vendorOrderId },
			include: {
				vendor: { select: vendorCardSelect },
				items: true,
				order: {
					select: {
						id: true,
						orderNumber: true,
						orderStatus: true,
						paymentStatus: true,
					},
				},
			},
		});

		return { result: updated, refundId: pendingRefundId };
	});

	// Outside the transaction: move the money.
	//
	// `throwOnError: false` on purpose — the cancellation has already
	// committed and is not undone by a gateway hiccup. A failure is recorded
	// on the Refund row, surfaced in the admin refunds queue, and retried by
	// `processPendingRefunds()`. Reporting the whole request as failed here
	// would tell the caller the cancel did not happen, which is false.
	if (refundId) {
		await processRefund(refundId);
		// Only fires if the refund actually SUCCEEDED; the helper checks.
		await notifyRefundProcessed(refundId);
	}

	// The parcel moved. Non-fatal, and outside the transaction above.
	await notifyVendorOrderStatusChanged(vendorOrderId);

	// Re-read so the caller sees the payment status the refund produced
	// (PARTIALLY_REFUNDED / REFUNDED) rather than the pre-refund value.
	if (refundId) {
		return prisma.vendorOrder.findUniqueOrThrow({
			where: { id: vendorOrderId },
			include: {
				vendor: { select: vendorCardSelect },
				items: true,
				refund: true,
				order: {
					select: {
						id: true,
						orderNumber: true,
						orderStatus: true,
						paymentStatus: true,
					},
				},
			},
		});
	}

	return result;
};

/**
 * Keep the order's single Payment row consistent with its vendor orders.
 *
 * There is one charge per order but N independently-cancellable slices, so
 * COD becomes PAID once every live slice is delivered.
 *
 * Refund state is NOT computed here. `Payment.refundAmount` and the
 * REFUNDED / PARTIALLY_REFUNDED statuses are owned exclusively by
 * `recomputePaymentRefundState` in src/helpers/refund.ts, driven by the Refund
 * ledger — so the summary can never claim money went back when no refund
 * actually succeeded. This function must leave those fields alone.
 */
const reconcilePayment = async (
	tx: Prisma.TransactionClient,
	orderId: string,
) => {
	const order = await tx.order.findUniqueOrThrow({
		where: { id: orderId },
		include: { vendorOrders: true, payment: true },
	});

	if (!order.payment) return;

	const slices = order.vendorOrders;
	const live = slices.filter(
		(slice) => slice.orderStatus !== OrderStatus.CANCELED,
	);

	const wasPaid =
		order.paymentStatus === PaymentStatus.PAID ||
		order.paymentStatus === PaymentStatus.PARTIALLY_REFUNDED ||
		order.payment.status === PaymentStatus.PAID ||
		order.payment.status === PaymentStatus.PARTIALLY_REFUNDED;

	let paymentStatus: PaymentStatus = order.paymentStatus;

	if (live.length === 0 && !wasPaid) {
		// Everything cancelled on an order that was never paid: the charge
		// will never land. A PAID order that is fully cancelled is left to
		// the refund ledger, which flips it to REFUNDED once the money is
		// actually back with the buyer.
		paymentStatus = PaymentStatus.FAILED;
	} else if (
		order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY &&
		live.length > 0 &&
		live.every((slice) => slice.orderStatus === OrderStatus.DELIVERED)
	) {
		// Cash collected on the doorstep for every parcel that shipped.
		paymentStatus = PaymentStatus.PAID;
	}

	const paidAt =
		paymentStatus === PaymentStatus.PAID && !order.payment.paidAt
			? new Date()
			: order.payment.paidAt;

	await tx.payment.update({
		where: { orderId },
		data: { status: paymentStatus, paidAt },
	});

	if (paymentStatus !== order.paymentStatus) {
		await tx.order.update({
			where: { id: orderId },
			data: { paymentStatus },
		});
	}
};

/**
 * Platform-wide analytics. ADMIN only.
 *
 * Platform revenue is COMMISSION, not gross merchandise value — GMV mostly
 * belongs to the vendors, so both are reported separately.
 */
const getDashboardAnalytics = async (startDate?: Date, endDate?: Date) => {
	const dateFilter =
		startDate && endDate
			? {
				createdAt: {
					gte: startDate,
					lte: endDate,
				},
			}
			: {};

	const [
		totalOrders,
		totalRevenue,
		commissionTotals,
		ordersByStatus,
		topProducts,
		topVendors,
		vendorCounts,
		recentOrders,
	] = await Promise.all([
		// Total orders
		prisma.order.count({ where: dateFilter }),

		// Gross merchandise value (only paid orders)
		prisma.order.aggregate({
			where: {
				...dateFilter,
				paymentStatus: PaymentStatus.PAID,
			},
			_sum: { totalAmount: true },
		}),

		// What the platform actually earns, and what it owes out.
		prisma.vendorOrder.aggregate({
			where: {
				...dateFilter,
				orderStatus: { not: OrderStatus.CANCELED },
				order: { paymentStatus: PaymentStatus.PAID },
			},
			_sum: { commissionAmount: true, vendorEarning: true },
		}),

		// Orders by status
		prisma.order.groupBy({
			by: ["orderStatus"],
			where: dateFilter,
			_count: { id: true },
		}),

		// Top products
		prisma.orderItem.groupBy({
			by: ["productId", "productName"],
			where: {
				order: dateFilter,
			},
			_sum: {
				quantity: true,
			},
			orderBy: {
				_sum: {
					quantity: "desc",
				},
			},
			take: 10,
		}),

		// Top vendors by commission generated
		prisma.vendorOrder.groupBy({
			by: ["vendorId"],
			where: {
				...dateFilter,
				orderStatus: { not: OrderStatus.CANCELED },
				order: { paymentStatus: PaymentStatus.PAID },
			},
			_sum: {
				totalAmount: true,
				commissionAmount: true,
				vendorEarning: true,
			},
			_count: { id: true },
			orderBy: { _sum: { commissionAmount: "desc" } },
			take: 10,
		}),

		prisma.vendor.groupBy({
			by: ["status"],
			where: { isDeleted: false },
			_count: { id: true },
		}),

		// Recent orders
		prisma.order.findMany({
			where: dateFilter,
			include: {
				user: {
					select: { name: true, auth: { select: { email: true } } },
				},
				vendorOrders: {
					select: {
						id: true,
						orderStatus: true,
						totalAmount: true,
						vendor: { select: vendorCardSelect },
					},
				},
			},
			orderBy: { createdAt: "desc" },
			take: 10,
		}),
	]);

	const totalRevenueAmount = toNumber(totalRevenue._sum.totalAmount);

	// Resolve store names for the top-vendor rows in one extra query.
	const topVendorIds = topVendors.map((row) => row.vendorId);
	const vendorNames = topVendorIds.length
		? await prisma.vendor.findMany({
			where: { id: { in: topVendorIds } },
			select: { id: true, storeName: true, slug: true },
		})
		: [];
	const vendorNameById = new Map(
		vendorNames.map((vendor) => [vendor.id, vendor]),
	);

	return {
		overview: {
			totalOrders,
			// Gross merchandise value — what buyers paid in total.
			totalRevenue: totalRevenueAmount,
			// The platform's own earnings.
			platformCommission: toNumber(commissionTotals._sum.commissionAmount),
			// What is owed to (or already settled with) vendors.
			vendorEarnings: toNumber(commissionTotals._sum.vendorEarning),
			averageOrderValue:
				totalOrders > 0
					? round2(totalRevenueAmount / totalOrders)
					: 0,
		},
		ordersByStatus: ordersByStatus.map((item) => ({
			status: item.orderStatus,
			count: item._count.id,
		})),
		vendorsByStatus: vendorCounts.map((item) => ({
			status: item.status,
			count: item._count.id,
		})),
		topProducts: topProducts.map((item) => ({
			productId: item.productId,
			productName: item.productName,
			quantitySold: item._sum.quantity || 0,
		})),
		topVendors: topVendors.map((item) => ({
			vendorId: item.vendorId,
			storeName: vendorNameById.get(item.vendorId)?.storeName ?? null,
			slug: vendorNameById.get(item.vendorId)?.slug ?? null,
			orders: item._count.id,
			grossSales: toNumber(item._sum.totalAmount),
			commission: toNumber(item._sum.commissionAmount),
			vendorEarnings: toNumber(item._sum.vendorEarning),
		})),
		recentOrders,
	};
};

/**
 * The shopper dashboard's headline numbers, for the caller's OWN purchases —
 * a VENDOR calling this gets what they bought, never what they sold.
 *
 * Aggregated here rather than on the client: the alternative is paging every
 * order down just to add up a total.
 *
 * `totalSpent` is money that actually moved: payments that completed, minus
 * `Payment.refundAmount` (money that actually went back — not what is owed).
 * An unpaid or failed payment spent nothing; a refund still FAILED is not
 * subtracted, because the buyer has not had it yet.
 */
const getMySummary = async (userId: string) => {
	const [orderCount, payments, parcels, openRefunds, deliveredItems, reviewed] =
		await Promise.all([
			prisma.order.count({ where: { userId } }),
			prisma.payment.aggregate({
				where: {
					order: { userId },
					status: {
						in: [
							PaymentStatus.PAID,
							PaymentStatus.PARTIALLY_REFUNDED,
							PaymentStatus.REFUNDED,
						],
					},
				},
				_sum: { amount: true, refundAmount: true },
			}),
			prisma.vendorOrder.groupBy({
				by: ["orderStatus"],
				where: { order: { userId } },
				_count: { _all: true },
			}),
			// Money still owed back: not yet sent, being sent, or failed.
			prisma.refund.aggregate({
				where: {
					order: { userId },
					status: {
						in: [
							RefundStatus.PENDING,
							RefundStatus.PROCESSING,
							RefundStatus.FAILED,
						],
					},
				},
				_count: { _all: true },
				_sum: { amount: true },
			}),
			// Only products still on sale can be reviewed (`createIntoDB`
			// requires `publicProductFilter`), so only those are prompted.
			prisma.orderItem.findMany({
				where: {
					order: { userId },
					vendorOrder: { orderStatus: OrderStatus.DELIVERED },
					product: publicProductFilter(),
				},
				select: {
					productId: true,
					product: { select: { name: true, slug: true } },
				},
				distinct: ["productId"],
			}),
			prisma.review.findMany({
				where: { userId, isDeleted: false },
				select: { productId: true },
			}),
		]);

	const parcelCount = (...statuses: OrderStatus[]) =>
		parcels
			.filter((row) => statuses.includes(row.orderStatus))
			.reduce((sum, row) => sum + row._count._all, 0);

	const reviewedIds = new Set(reviewed.map((row) => row.productId));

	return {
		totalOrders: orderCount,
		totalSpent: round2(
			toNumber(payments._sum.amount) - toNumber(payments._sum.refundAmount),
		),
		parcels: {
			inProgress: parcelCount(
				OrderStatus.PENDING,
				OrderStatus.PROCESSING,
				OrderStatus.SHIPPED,
			),
			delivered: parcelCount(OrderStatus.DELIVERED),
			canceled: parcelCount(OrderStatus.CANCELED),
		},
		openRefunds: {
			count: openRefunds._count._all,
			amount: round2(toNumber(openRefunds._sum.amount)),
		},
		awaitingReview: (() => {
			const pending = deliveredItems.filter(
				(row) => !reviewedIds.has(row.productId),
			);
			// A few, so the dashboard can link straight to each product page —
			// that is where a product review is written.
			return {
				count: pending.length,
				products: pending.slice(0, 3).map((row) => row.product),
			};
		})(),
	};
};

export const orderServices = {
	getMySummary,
	createOrder,
	findAllFromDB,
	getMyOrders,
	getOrderById,
	//
	getMyVendorOrders,
	getVendorOrderById,
	updateVendorOrderStatus,
	//
	getDashboardAnalytics,
};
