import {
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    Prisma,
} from "../../../generated/prisma";
import { prisma } from "../../config/db";
import { ensureTransitionAllowed } from "../../helpers/allowedTransition";
import PrismaQueryBuilder from "../../lib/PrismaQueryBuilder";
import CustomError from "../../utils/customError";
import { createStripePaymentUrl } from "../../helpers/stripe";
import { CreateOrderInput } from "../../types/common.types";
import {
    generateOrderNumber,
    validateAndCalculateOrder,
} from "../../helpers/order";
import { createCODOrder } from "../../helpers/cod";

/**
 * Create order - handles both Stripe and COD
 */
const createOrder = async (payload: CreateOrderInput) => {
    // 1. Validate user exists
    const user = await prisma.user.findUnique({
        where: { id: payload.userId },
    });
    if (!user) {
        throw new CustomError(404, "User not found");
    }

    // 2. Validate shipping address belongs to user
    const shippingAddress = await prisma.address.findFirst({
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

    // 3. Validate items and calculate totals (SECURE - fetches prices from DB)
    const calculation = await validateAndCalculateOrder(payload.items);

    // 4. Generate unique order number
    const orderNumber = await generateOrderNumber();

    // 5. Handle payment method specific logic
    if (payload.paymentMethod === PaymentMethod.STRIPE) {
        // Order will be created in webhook after successful payment
        const paymentUrl = await createStripePaymentUrl(
            payload.userId,
            payload.shippingAddressId,
            calculation,
            orderNumber,
            payload.ipAddress,
            payload.userAgent,
            payload.notes,
        );

        return { paymentUrl, orderNumber };
    } else if (payload.paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
        // For COD, create order immediately
        const order = await createCODOrder(payload, calculation, orderNumber);

        return { order, paymentUrl: null };
    } else {
        throw new CustomError(400, "Invalid payment method");
    }
};

/**
 * Find all orders with filtering and pagination
 */
const findAllFromDB = async (query: Record<string, unknown>) => {
    const builder = new PrismaQueryBuilder<Prisma.OrderWhereInput>(query);

    const prismaArgs = builder
        .filter()
        .paginate()
        .include({
            user: { select: { name: true, avatar: true, email: true } },
            items: {
                include: {
                    product: {
                        select: {
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
            shippingAddress: true,
            payment: true,
        })
        .build();

    const orders = await prisma.order.findMany(prismaArgs);
    const meta = await builder.getMeta(prisma.order);

    return { meta, orders };
};

/**
 * Get user's orders
 */
const getMyOrders = async (userId: string) => {
    const orders = await prisma.order.findMany({
        where: { userId },
        include: {
            items: {
                include: {
                    product: {
                        select: {
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
            shippingAddress: true,
            payment: true,
        },
        orderBy: { createdAt: "desc" },
    });

    return orders;
};

/**
 * Get single order by ID
 */
const getOrderById = async (orderId: string, userId?: string) => {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            items: {
                include: {
                    product: {
                        select: {
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
            shippingAddress: true,
            payment: true,
            statusHistory: {
                orderBy: { createdAt: "desc" },
            },
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    if (!order) {
        throw new CustomError(404, "Order not found");
    }

    // Authorization check (if userId provided)
    if (userId && order.userId !== userId) {
        throw new CustomError(403, "Not authorized to view this order");
    }

    return order;
};

/**
 * Update order status with validation
 */
const updateOrderStatus = async (
    orderId: string,
    newStatus: OrderStatus,

) => {
    return prisma.$transaction(async (tx) => {
        // 1. Get current order
        const order = await tx.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        });

        if (!order) {
            throw new CustomError(404, "Order not found");
        }

        // 2. Validate status transition
        ensureTransitionAllowed(order.orderStatus, newStatus);

        // 3. Payment validation for Stripe orders
        const isStripe = order.paymentMethod === PaymentMethod.STRIPE;

        if (
            newStatus === OrderStatus.SHIPPED &&
            isStripe &&
            order.paymentStatus !== PaymentStatus.PAID
        ) {
            throw new CustomError(
                400,
                "Cannot ship order until payment is completed",
            );
        }

        if (
            newStatus === OrderStatus.DELIVERED &&
            isStripe &&
            order.paymentStatus !== PaymentStatus.PAID
        ) {
            throw new CustomError(
                400,
                "Cannot deliver order until payment is completed",
            );
        }

        // 4. Calculate payment status updates
        let newPaymentStatus: PaymentStatus | undefined;

        if (newStatus === OrderStatus.DELIVERED) {
            // COD becomes PAID at delivery
            if (order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
                newPaymentStatus = PaymentStatus.PAID;
            }
        }

        if (newStatus === OrderStatus.CANCELED) {
            // Refund logic
            newPaymentStatus =
                order.paymentStatus === PaymentStatus.PAID
                    ? PaymentStatus.REFUNDED
                    : PaymentStatus.FAILED;

            // Restore stock on cancellation
            for (const item of order.items) {
                if (item.variantId) {
                    await tx.productVariant.update({
                        where: { id: item.variantId },
                        data: { stock: { increment: item.quantity } },
                    });

                } else {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stockQuantity: { increment: item.quantity } },
                    });
                }
            }
        }

        // 5. Update payment if needed
        if (newPaymentStatus) {
            await tx.payment.update({
                where: { orderId },
                data: {
                    status: newPaymentStatus,
                    refundedAt:
                        newPaymentStatus === PaymentStatus.REFUNDED
                            ? new Date()
                            : undefined,
                },
            });
        }

        // 6. Update order
        const updatedOrder = await tx.order.update({
            where: { id: orderId },
            data: {
                orderStatus: newStatus,
                paymentStatus: newPaymentStatus ?? order.paymentStatus,
            },
            include: {
                items: true,
                payment: true,
                shippingAddress: true,
            },
        });


        return updatedOrder;
    });
};

/**
 * Get dashboard analytics
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
        ordersByStatus,
        topProducts,
        recentOrders,
    ] = await Promise.all([
        // Total orders
        prisma.order.count({ where: dateFilter }),

        // Total revenue (only paid orders)
        prisma.order.aggregate({
            where: {
                ...dateFilter,
                paymentStatus: PaymentStatus.PAID,
            },
            _sum: { totalAmount: true },
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

        // Recent orders
        prisma.order.findMany({
            where: dateFilter,
            include: {
                user: {
                    select: { name: true, email: true },
                },
                items: true,
            },
            orderBy: { createdAt: "desc" },
            take: 10,
        }),
    ]);

    const totalRevenueAmount = totalRevenue._sum.totalAmount
        ? totalRevenue._sum.totalAmount.toNumber()
        : 0;
    return {
        overview: {
            totalOrders,
            totalRevenue: totalRevenueAmount,
            averageOrderValue:
                totalOrders > 0
                    ? parseFloat(
                          ((totalRevenueAmount || 0) / totalOrders).toString(),
                      )
                    : 0,
        },
        ordersByStatus: ordersByStatus.map((item) => ({
            status: item.orderStatus,
            count: item._count.id,
        })),
        topProducts: topProducts.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantitySold: item._sum.quantity || 0,
        })),
        recentOrders,
    };
};

export const orderServices = {
    createOrder,
    findAllFromDB,
    getMyOrders,
    getOrderById,
    updateOrderStatus,
    getDashboardAnalytics,
};
