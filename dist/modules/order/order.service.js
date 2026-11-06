"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderServices = void 0;
const prisma_client_1 = require("../../lib/prisma-client.js");
const db_1 = require("../../config/db.js");
const allowedTransition_1 = require("../../helpers/allowedTransition.js");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder.js"));
const customError_1 = __importDefault(require("../../utils/customError.js"));
const stripe_1 = require("../../helpers/stripe.js");
const order_1 = require("../../helpers/order.js");
const cod_1 = require("../../helpers/cod.js");
const checkout_1 = require("../../helpers/checkout.js");
const money_1 = require("../../helpers/money.js");
const refund_1 = require("../../helpers/refund.js");
const notifications_1 = require("../../helpers/notifications.js");
const vendor_1 = require("../../helpers/vendor.js");
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
};
/**
 * Everyone sees the timeline; only an ADMIN sees who did it and from where.
 *
 * A buyer does not need the seller's personal name (the store name is already
 * on the parcel), a seller does not need the buyer's, and nobody outside the
 * platform needs an IP address — that field exists for abuse investigation,
 * which is an admin activity.
 */
const sanitizeStatusHistory = (history, isAdmin) => history.map(({ ipAddress, user, ...event }) => isAdmin ? { ...event, ipAddress, actor: user } : event);
const vendorCardSelect = {
    id: true,
    storeName: true,
    slug: true,
    logo: true,
};
/**
 * Place an order.
 *
 * The cart is priced and split by vendor server-side. For STRIPE no order row
 * is written here — the priced split is persisted as a CheckoutSession and the
 * order is created by the webhook once the charge succeeds. COD creates the
 * order inline.
 */
const createOrder = async (payload) => {
    // 1. Validate user exists
    const user = await db_1.prisma.user.findUnique({
        where: { id: payload.userId },
    });
    if (!user) {
        throw new customError_1.default(404, "User not found");
    }
    // 2. Resolve shipping address
    let shippingAddress;
    if (payload.shippingAddressId) {
        // Use existing address — validate it belongs to the user
        shippingAddress = await db_1.prisma.address.findFirst({
            where: {
                id: payload.shippingAddressId,
                userId: payload.userId,
                isDeleted: false,
            },
        });
        if (!shippingAddress) {
            throw new customError_1.default(404, "Shipping address not found or does not belong to user");
        }
    }
    else if (payload.address) {
        // Create a new address on the fly
        shippingAddress = await db_1.prisma.address.create({
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
    }
    else {
        throw new customError_1.default(400, "Either shippingAddressId or address fields are required");
    }
    // 3. Price the cart from the database, grouped by vendor (SECURE — never
    //    trusts client prices, and rejects items from suspended stores).
    const calculation = await (0, order_1.validateAndCalculateOrder)(payload.items);
    // 4. Generate unique order number
    const orderNumber = await (0, order_1.generateOrderNumber)();
    // 5. Handle payment method specific logic
    if (payload.paymentMethod === prisma_client_1.PaymentMethod.STRIPE) {
        // Persist the priced split first: the webhook, not this request,
        // creates the order, and Stripe metadata is far too small to carry a
        // multi-vendor cart.
        const draft = await (0, checkout_1.createCheckoutSession)({
            orderNumber,
            userId: payload.userId,
            shippingAddressId: shippingAddress.id,
            paymentMethod: prisma_client_1.PaymentMethod.STRIPE,
            calculation,
            notes: payload.notes,
            ipAddress: payload.ipAddress,
            userAgent: payload.userAgent,
        });
        const { url, stripeSessionId } = await (0, stripe_1.createStripePaymentUrl)({
            userId: payload.userId,
            checkoutSessionId: draft.id,
            orderNumber,
            calculation,
        });
        await (0, checkout_1.attachStripeSession)(draft.id, stripeSessionId);
        return {
            paymentUrl: url,
            orderNumber,
            // The per-vendor breakdown, so the frontend can show what each
            // store charges without recomputing it.
            vendors: calculation.vendors.map(summariseVendorGroup),
            totalAmount: calculation.totalAmount,
        };
    }
    else if (payload.paymentMethod === prisma_client_1.PaymentMethod.CASH_ON_DELIVERY) {
        // For COD, create order immediately
        const order = await (0, cod_1.createCODOrder)({
            userId: payload.userId,
            shippingAddressId: shippingAddress.id,
            calculation,
            orderNumber,
            notes: payload.notes,
            ipAddress: payload.ipAddress,
            userAgent: payload.userAgent,
        });
        return { order, paymentUrl: null };
    }
    else {
        throw new customError_1.default(400, "Invalid payment method");
    }
};
const summariseVendorGroup = (vendor) => ({
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
const findAllFromDB = async (query) => {
    const builder = new PrismaQueryBuilder_1.default(query);
    const prismaArgs = builder
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
        db_1.prisma.order.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.order),
    ]);
    return { meta, orders };
};
/**
 * A buyer's own orders, each with its per-vendor slices so the UI can show
 * "shipped by Store A, still processing at Store B".
 */
const getMyOrders = async (userId, query) => {
    const builder = new PrismaQueryBuilder_1.default(query);
    const prismaArgs = builder
        .addWhere({ userId })
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
        db_1.prisma.order.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.order),
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
const getOrderById = async (orderId, actor) => {
    const order = await db_1.prisma.order.findUnique({
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
        throw new customError_1.default(404, "Order not found");
    }
    const isAdmin = actor.role === prisma_client_1.Role.ADMIN;
    /** Re-attach each parcel's history, narrowed for this caller. */
    const withSafeHistory = (slices) => slices.map((slice) => ({
        ...slice,
        statusHistory: sanitizeStatusHistory(slice.statusHistory, isAdmin),
    }));
    if (isAdmin || order.userId === actor.id) {
        return { ...order, vendorOrders: withSafeHistory(order.vendorOrders) };
    }
    if (actor.role === prisma_client_1.Role.VENDOR) {
        const vendor = await (0, vendor_1.requireApprovedVendor)(actor.id);
        const mine = order.vendorOrders.filter((vendorOrder) => vendorOrder.vendorId === vendor.id);
        if (mine.length === 0) {
            throw new customError_1.default(404, "Order not found");
        }
        // Narrow to this vendor's slice, and drop the money fields that
        // describe the whole basket.
        return {
            ...order,
            vendorOrders: withSafeHistory(mine),
            subtotal: undefined,
            tax: undefined,
            shippingCost: undefined,
            discount: undefined,
            totalAmount: undefined,
        };
    }
    throw new customError_1.default(403, "Not authorized to view this order");
};
// ---------------------------------------------------------------- vendor views
/**
 * The vendor's order queue — their slices only, never the parent orders.
 */
const getMyVendorOrders = async (actor, query) => {
    const scope = actor.role === prisma_client_1.Role.ADMIN && query.vendorId
        ? { vendorId: String(query.vendorId) }
        : { vendorId: (await (0, vendor_1.requireApprovedVendor)(actor.id)).id };
    const { vendorId: _ignored, ...rest } = query;
    const builder = new PrismaQueryBuilder_1.default(rest);
    const prismaArgs = builder
        .withDefaultFilter(scope)
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
        db_1.prisma.vendorOrder.findMany(prismaArgs),
        builder.getMeta(db_1.prisma.vendorOrder),
    ]);
    return { meta, vendorOrders };
};
const getVendorOrderById = async (actor, vendorOrderId) => {
    if (actor.role !== prisma_client_1.Role.ADMIN) {
        const vendor = await (0, vendor_1.requireApprovedVendor)(actor.id);
        await (0, vendor_1.assertVendorOwnsVendorOrder)(vendor.id, vendorOrderId);
    }
    const vendorOrder = await db_1.prisma.vendorOrder.findUnique({
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
        throw new customError_1.default(404, "Order not found");
    }
    // Vendor-facing, so the seller must not read the buyer's IP off their own
    // parcel's trail. Admins keep the full audit view.
    return {
        ...vendorOrder,
        statusHistory: sanitizeStatusHistory(vendorOrder.statusHistory, actor.role === prisma_client_1.Role.ADMIN),
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
const resolveOrderActorCapacity = async (actor, vendorOrderId) => {
    if (actor.role === prisma_client_1.Role.ADMIN) {
        return "admin";
    }
    const vendorOrder = await db_1.prisma.vendorOrder.findUnique({
        where: { id: vendorOrderId },
        select: {
            vendorId: true,
            order: { select: { userId: true } },
        },
    });
    if (!vendorOrder) {
        throw new customError_1.default(404, "Order not found");
    }
    // Does this caller own the STORE that is shipping this parcel?
    const ownsSellingStore = await db_1.prisma.vendor.findFirst({
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
        const vendor = await (0, vendor_1.requireApprovedVendor)(actor.id);
        await (0, vendor_1.assertVendorOwnsVendorOrder)(vendor.id, vendorOrderId);
        return "seller";
    }
    // Otherwise: is this a parcel of an order they placed?
    if (vendorOrder.order.userId === actor.id) {
        return "buyer";
    }
    // Neither. 404 rather than 403, so another user's order ids stay
    // unguessable — the convention used throughout `src/helpers/vendor.ts`.
    throw new customError_1.default(404, "Order not found");
};
const defaultCancelReason = (capacity) => {
    if (capacity === "buyer")
        return "Canceled by customer";
    if (capacity === "admin")
        return "Canceled by admin";
    return "Canceled by seller";
};
const updateVendorOrderStatus = async (actor, vendorOrderId, payload, ipAddress) => {
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
    const { result, refundId } = await db_1.prisma.$transaction(async (tx) => {
        const vendorOrder = await tx.vendorOrder.findUnique({
            where: { id: vendorOrderId },
            include: {
                items: true,
                order: { include: { payment: true } },
            },
        });
        if (!vendorOrder) {
            throw new customError_1.default(404, "Order not found");
        }
        const previousStatus = vendorOrder.orderStatus;
        // 1. State machine + what this capacity may do
        (0, allowedTransition_1.ensureTransitionAllowedForActor)(previousStatus, newStatus, capacity);
        const order = vendorOrder.order;
        const isStripe = order.paymentMethod === prisma_client_1.PaymentMethod.STRIPE;
        // 2. A prepaid order must actually be paid before it moves goods.
        if (isStripe &&
            order.paymentStatus !== prisma_client_1.PaymentStatus.PAID &&
            (newStatus === prisma_client_1.OrderStatus.SHIPPED ||
                newStatus === prisma_client_1.OrderStatus.DELIVERED)) {
            throw new customError_1.default(400, "Cannot ship or deliver until payment is completed");
        }
        // 3. Cancelling returns this slice's stock — and only this slice's.
        if (newStatus === prisma_client_1.OrderStatus.CANCELED) {
            for (const item of vendorOrder.items) {
                if (item.variantId) {
                    await tx.productVariant.update({
                        where: { id: item.variantId },
                        data: { stock: { increment: item.quantity } },
                    });
                }
                else {
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
                trackingNumber: capacity === "buyer"
                    ? undefined
                    : (payload.trackingNumber ?? undefined),
                carrier: capacity === "buyer"
                    ? undefined
                    : (payload.carrier ?? undefined),
                cancelReason: newStatus === prisma_client_1.OrderStatus.CANCELED
                    ? (payload.cancelReason ??
                        defaultCancelReason(capacity))
                    : undefined,
                shippedAt: newStatus === prisma_client_1.OrderStatus.SHIPPED ? now : undefined,
                deliveredAt: newStatus === prisma_client_1.OrderStatus.DELIVERED ? now : undefined,
                canceledAt: newStatus === prisma_client_1.OrderStatus.CANCELED ? now : undefined,
            },
        });
        await (0, order_1.logStatusChange)(tx, {
            orderId: order.id,
            vendorOrderId,
            oldStatus: previousStatus,
            newStatus,
            userId: actor.id,
            note: newStatus === prisma_client_1.OrderStatus.CANCELED
                ? (payload.cancelReason ??
                    defaultCancelReason(capacity))
                : undefined,
            ipAddress,
        });
        // 5. Roll the parent order's derived status and totals forward.
        await (0, order_1.recalculateOrderRollup)(tx, order.id);
        // 6. Reconcile the single payment row against the new slice states.
        await reconcilePayment(tx, order.id);
        // 7. A cancelled parcel of a paid order owes the buyer money. Record
        //    that in the same transaction as the cancellation — either both
        //    happen or neither does — and send it to the gateway after commit.
        //    Returns null for the cases with nothing to refund (unpaid order,
        //    cash on delivery, parcel already refunded).
        let pendingRefundId = null;
        if (newStatus === prisma_client_1.OrderStatus.CANCELED) {
            pendingRefundId = await (0, refund_1.recordRefundIntent)(tx, {
                orderId: order.id,
                vendorOrderId,
                amount: (0, money_1.toNumber)(vendorOrder.totalAmount),
                reason: payload.cancelReason ??
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
        await (0, refund_1.processRefund)(refundId);
        // Only fires if the refund actually SUCCEEDED; the helper checks.
        await (0, notifications_1.notifyRefundProcessed)(refundId);
    }
    // The parcel moved. Non-fatal, and outside the transaction above.
    await (0, notifications_1.notifyVendorOrderStatusChanged)(vendorOrderId);
    // Re-read so the caller sees the payment status the refund produced
    // (PARTIALLY_REFUNDED / REFUNDED) rather than the pre-refund value.
    if (refundId) {
        return db_1.prisma.vendorOrder.findUniqueOrThrow({
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
const reconcilePayment = async (tx, orderId) => {
    const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { vendorOrders: true, payment: true },
    });
    if (!order.payment)
        return;
    const slices = order.vendorOrders;
    const live = slices.filter((slice) => slice.orderStatus !== prisma_client_1.OrderStatus.CANCELED);
    const wasPaid = order.paymentStatus === prisma_client_1.PaymentStatus.PAID ||
        order.paymentStatus === prisma_client_1.PaymentStatus.PARTIALLY_REFUNDED ||
        order.payment.status === prisma_client_1.PaymentStatus.PAID ||
        order.payment.status === prisma_client_1.PaymentStatus.PARTIALLY_REFUNDED;
    let paymentStatus = order.paymentStatus;
    if (live.length === 0 && !wasPaid) {
        // Everything cancelled on an order that was never paid: the charge
        // will never land. A PAID order that is fully cancelled is left to
        // the refund ledger, which flips it to REFUNDED once the money is
        // actually back with the buyer.
        paymentStatus = prisma_client_1.PaymentStatus.FAILED;
    }
    else if (order.paymentMethod === prisma_client_1.PaymentMethod.CASH_ON_DELIVERY &&
        live.length > 0 &&
        live.every((slice) => slice.orderStatus === prisma_client_1.OrderStatus.DELIVERED)) {
        // Cash collected on the doorstep for every parcel that shipped.
        paymentStatus = prisma_client_1.PaymentStatus.PAID;
    }
    const paidAt = paymentStatus === prisma_client_1.PaymentStatus.PAID && !order.payment.paidAt
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
const getDashboardAnalytics = async (startDate, endDate) => {
    const dateFilter = startDate && endDate
        ? {
            createdAt: {
                gte: startDate,
                lte: endDate,
            },
        }
        : {};
    const [totalOrders, totalRevenue, commissionTotals, ordersByStatus, topProducts, topVendors, vendorCounts, recentOrders,] = await Promise.all([
        // Total orders
        db_1.prisma.order.count({ where: dateFilter }),
        // Gross merchandise value (only paid orders)
        db_1.prisma.order.aggregate({
            where: {
                ...dateFilter,
                paymentStatus: prisma_client_1.PaymentStatus.PAID,
            },
            _sum: { totalAmount: true },
        }),
        // What the platform actually earns, and what it owes out.
        db_1.prisma.vendorOrder.aggregate({
            where: {
                ...dateFilter,
                orderStatus: { not: prisma_client_1.OrderStatus.CANCELED },
                order: { paymentStatus: prisma_client_1.PaymentStatus.PAID },
            },
            _sum: { commissionAmount: true, vendorEarning: true },
        }),
        // Orders by status
        db_1.prisma.order.groupBy({
            by: ["orderStatus"],
            where: dateFilter,
            _count: { id: true },
        }),
        // Top products
        db_1.prisma.orderItem.groupBy({
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
        db_1.prisma.vendorOrder.groupBy({
            by: ["vendorId"],
            where: {
                ...dateFilter,
                orderStatus: { not: prisma_client_1.OrderStatus.CANCELED },
                order: { paymentStatus: prisma_client_1.PaymentStatus.PAID },
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
        db_1.prisma.vendor.groupBy({
            by: ["status"],
            where: { isDeleted: false },
            _count: { id: true },
        }),
        // Recent orders
        db_1.prisma.order.findMany({
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
    const totalRevenueAmount = (0, money_1.toNumber)(totalRevenue._sum.totalAmount);
    // Resolve store names for the top-vendor rows in one extra query.
    const topVendorIds = topVendors.map((row) => row.vendorId);
    const vendorNames = topVendorIds.length
        ? await db_1.prisma.vendor.findMany({
            where: { id: { in: topVendorIds } },
            select: { id: true, storeName: true, slug: true },
        })
        : [];
    const vendorNameById = new Map(vendorNames.map((vendor) => [vendor.id, vendor]));
    return {
        overview: {
            totalOrders,
            // Gross merchandise value — what buyers paid in total.
            totalRevenue: totalRevenueAmount,
            // The platform's own earnings.
            platformCommission: (0, money_1.toNumber)(commissionTotals._sum.commissionAmount),
            // What is owed to (or already settled with) vendors.
            vendorEarnings: (0, money_1.toNumber)(commissionTotals._sum.vendorEarning),
            averageOrderValue: totalOrders > 0
                ? (0, money_1.round2)(totalRevenueAmount / totalOrders)
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
            grossSales: (0, money_1.toNumber)(item._sum.totalAmount),
            commission: (0, money_1.toNumber)(item._sum.commissionAmount),
            vendorEarnings: (0, money_1.toNumber)(item._sum.vendorEarning),
        })),
        recentOrders,
    };
};
exports.orderServices = {
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
