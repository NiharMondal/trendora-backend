"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderServices = void 0;
const prisma_1 = require("../../../generated/prisma");
const db_1 = require("../../config/db");
const allowedTransition_1 = require("../../helpers/allowedTransition");
const PrismaQueryBuilder_1 = __importDefault(require("../../lib/PrismaQueryBuilder"));
const customError_1 = __importDefault(require("../../utils/customError"));
const stripe_1 = require("../../helpers/stripe");
const order_1 = require("../../helpers/order");
const cod_1 = require("../../helpers/cod");
const checkout_1 = require("../../helpers/checkout");
const money_1 = require("../../helpers/money");
const vendor_1 = require("../../helpers/vendor");
/** Store identity shown next to each slice of an order. */
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
    if (payload.paymentMethod === prisma_1.PaymentMethod.STRIPE) {
        // Persist the priced split first: the webhook, not this request,
        // creates the order, and Stripe metadata is far too small to carry a
        // multi-vendor cart.
        const draft = await (0, checkout_1.createCheckoutSession)({
            orderNumber,
            userId: payload.userId,
            shippingAddressId: shippingAddress.id,
            paymentMethod: prisma_1.PaymentMethod.STRIPE,
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
    else if (payload.paymentMethod === prisma_1.PaymentMethod.CASH_ON_DELIVERY) {
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
        payment: { select: { status: true, method: true, paidAt: true } },
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
                    statusHistory: { orderBy: { createdAt: "asc" } },
                },
            },
            payment: true,
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
    if (actor.role === prisma_1.Role.ADMIN || order.userId === actor.id) {
        return order;
    }
    if (actor.role === prisma_1.Role.VENDOR) {
        const vendor = await (0, vendor_1.requireApprovedVendor)(actor.id);
        const mine = order.vendorOrders.filter((vendorOrder) => vendorOrder.vendorId === vendor.id);
        if (mine.length === 0) {
            throw new customError_1.default(404, "Order not found");
        }
        // Narrow to this vendor's slice, and drop the money fields that
        // describe the whole basket.
        return {
            ...order,
            vendorOrders: mine,
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
    const scope = actor.role === prisma_1.Role.ADMIN && query.vendorId
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
    if (actor.role !== prisma_1.Role.ADMIN) {
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
            statusHistory: { orderBy: { createdAt: "asc" } },
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
    return vendorOrder;
};
/**
 * Advance one vendor order through the fulfilment state machine.
 *
 * This is the only place VendorOrder.orderStatus is written, and every write
 * is followed by `recalculateOrderRollup` so the parent order's derived status
 * and totals stay consistent. A VENDOR may only move their own slice, and only
 * through the transitions their role permits.
 */
const updateVendorOrderStatus = async (actor, vendorOrderId, payload, ipAddress) => {
    const newStatus = payload.orderStatus;
    // Ownership check happens outside the transaction so a 404 for someone
    // else's order costs nothing.
    if (actor.role !== prisma_1.Role.ADMIN) {
        const vendor = await (0, vendor_1.requireApprovedVendor)(actor.id);
        await (0, vendor_1.assertVendorOwnsVendorOrder)(vendor.id, vendorOrderId);
    }
    return db_1.prisma.$transaction(async (tx) => {
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
        // 1. State machine + role permissions
        (0, allowedTransition_1.ensureTransitionAllowedForRole)(previousStatus, newStatus, actor.role);
        const order = vendorOrder.order;
        const isStripe = order.paymentMethod === prisma_1.PaymentMethod.STRIPE;
        // 2. A prepaid order must actually be paid before it moves goods.
        if (isStripe &&
            order.paymentStatus !== prisma_1.PaymentStatus.PAID &&
            (newStatus === prisma_1.OrderStatus.SHIPPED ||
                newStatus === prisma_1.OrderStatus.DELIVERED)) {
            throw new customError_1.default(400, "Cannot ship or deliver until payment is completed");
        }
        // 3. Cancelling returns this slice's stock — and only this slice's.
        if (newStatus === prisma_1.OrderStatus.CANCELED) {
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
                trackingNumber: payload.trackingNumber ?? undefined,
                carrier: payload.carrier ?? undefined,
                cancelReason: newStatus === prisma_1.OrderStatus.CANCELED
                    ? (payload.cancelReason ?? "Canceled by seller")
                    : undefined,
                shippedAt: newStatus === prisma_1.OrderStatus.SHIPPED ? now : undefined,
                deliveredAt: newStatus === prisma_1.OrderStatus.DELIVERED ? now : undefined,
                canceledAt: newStatus === prisma_1.OrderStatus.CANCELED ? now : undefined,
            },
        });
        await (0, order_1.logStatusChange)(tx, {
            orderId: order.id,
            vendorOrderId,
            oldStatus: previousStatus,
            newStatus,
            userId: actor.id,
            note: newStatus === prisma_1.OrderStatus.CANCELED
                ? (payload.cancelReason ?? "Canceled by seller")
                : undefined,
            ipAddress,
        });
        // 5. Roll the parent order's derived status and totals forward.
        await (0, order_1.recalculateOrderRollup)(tx, order.id);
        // 6. Reconcile the single payment row against the new slice states.
        await reconcilePayment(tx, order.id);
        return tx.vendorOrder.findUniqueOrThrow({
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
    });
};
/**
 * Keep the order's single Payment row consistent with its vendor orders.
 *
 * There is one charge per order but N independently-cancellable slices, so:
 *   - COD becomes PAID once every live slice is delivered.
 *   - Cancelling a slice of a paid order accrues a refund; when nothing is
 *     left alive the payment is REFUNDED.
 *
 * NOTE: this is bookkeeping only. Moving money back to the buyer still needs a
 * gateway call (`stripe.refunds.create` against Payment.transactionId) — wire
 * that in here when refunds go live, using the accrued `refundAmount`.
 */
const reconcilePayment = async (tx, orderId) => {
    const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { vendorOrders: true, payment: true },
    });
    if (!order.payment)
        return;
    const slices = order.vendorOrders;
    const canceled = slices.filter((slice) => slice.orderStatus === prisma_1.OrderStatus.CANCELED);
    const live = slices.filter((slice) => slice.orderStatus !== prisma_1.OrderStatus.CANCELED);
    // What the buyer is owed back for slices that will never ship.
    const refundAmount = (0, money_1.round2)(canceled.reduce((total, slice) => total + (0, money_1.toNumber)(slice.totalAmount), 0));
    const wasPaid = order.paymentStatus === prisma_1.PaymentStatus.PAID ||
        order.payment.status === prisma_1.PaymentStatus.PAID;
    let paymentStatus = order.paymentStatus;
    if (live.length === 0) {
        // Everything canceled.
        paymentStatus = wasPaid
            ? prisma_1.PaymentStatus.REFUNDED
            : prisma_1.PaymentStatus.FAILED;
    }
    else if (order.paymentMethod === prisma_1.PaymentMethod.CASH_ON_DELIVERY &&
        live.every((slice) => slice.orderStatus === prisma_1.OrderStatus.DELIVERED)) {
        // Cash collected on the doorstep for every parcel that shipped.
        paymentStatus = prisma_1.PaymentStatus.PAID;
    }
    const paidAt = paymentStatus === prisma_1.PaymentStatus.PAID && !order.payment.paidAt
        ? new Date()
        : order.payment.paidAt;
    await tx.payment.update({
        where: { orderId },
        data: {
            status: paymentStatus,
            refundAmount: refundAmount > 0 ? refundAmount : null,
            refundedAt: refundAmount > 0
                ? (order.payment.refundedAt ?? new Date())
                : null,
            paidAt,
        },
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
                paymentStatus: prisma_1.PaymentStatus.PAID,
            },
            _sum: { totalAmount: true },
        }),
        // What the platform actually earns, and what it owes out.
        db_1.prisma.vendorOrder.aggregate({
            where: {
                ...dateFilter,
                orderStatus: { not: prisma_1.OrderStatus.CANCELED },
                order: { paymentStatus: prisma_1.PaymentStatus.PAID },
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
                orderStatus: { not: prisma_1.OrderStatus.CANCELED },
                order: { paymentStatus: prisma_1.PaymentStatus.PAID },
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
