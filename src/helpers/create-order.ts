import {
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    Prisma,
} from "@/lib/prisma-client";
import { OrderCalculation } from "@/types/common.types";
import CustomError from "@/utils/customError";
import { buildVendorOrderNumber, logStatusChange } from "./order";
import { deriveOrderStatus } from "./order";

/**
 * The single place an Order is written.
 *
 * Both payment branches funnel through here — COD calls it inline, Stripe calls
 * it from the webhook — so the shape of a created order (vendor splits, items,
 * payment row, status history, stock deduction) cannot drift between them.
 *
 * Must be called inside a `prisma.$transaction`: stock deduction and the order
 * insert have to succeed or fail together.
 */
export type TPersistOrderInput = {
    orderNumber: string;
    userId: string;
    shippingAddressId: string;
    calculation: OrderCalculation;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    /**
     * Status each vendor order starts in. COD starts PENDING (nothing paid
     * yet); a paid Stripe order goes straight to PROCESSING.
     */
    initialVendorStatus: OrderStatus;
    notes?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    // Payment-gateway detail, Stripe only
    transactionId?: string;
    paymentGateway?: string;
    gatewayResponse?: Prisma.InputJsonValue;
    paidAt?: Date;
};

export async function persistOrder(
    tx: Prisma.TransactionClient,
    input: TPersistOrderInput,
) {
    const { calculation } = input;

    if (calculation.vendors.length === 0) {
        throw new CustomError(400, "Cannot create an order with no items");
    }

    // 0. Snapshot the shipping address, so a later edit or delete of the
    //    address row never rewrites what this order was shipped to.
    const shippingAddress = await tx.address.findUnique({
        where: { id: input.shippingAddressId },
    });

    if (!shippingAddress) {
        throw new CustomError(404, "Shipping address not found");
    }

    // 1. Deduct stock. The `gte` guard makes each update conditional, so a
    //    concurrent order cannot drive stock negative — we detect the loss and
    //    abort the whole transaction instead of writing an oversold order.
    for (const item of calculation.items) {
        if (item.variantId) {
            const updated = await tx.productVariant.updateMany({
                where: { id: item.variantId, stock: { gte: item.quantity } },
                data: { stock: { decrement: item.quantity } },
            });

            if (updated.count === 0) {
                throw new CustomError(
                    400,
                    `Insufficient stock for ${item.productName}`,
                );
            }
        } else {
            const updated = await tx.product.updateMany({
                where: {
                    id: item.productId,
                    stockQuantity: { gte: item.quantity },
                },
                data: { stockQuantity: { decrement: item.quantity } },
            });

            if (updated.count === 0) {
                throw new CustomError(
                    400,
                    `Insufficient stock for ${item.productName}`,
                );
            }
        }
    }

    // 2. Create the buyer-facing order. `orderStatus` is the derived rollup of
    //    the slices we are about to create.
    const order = await tx.order.create({
        data: {
            orderNumber: input.orderNumber,
            userId: input.userId,
            subtotal: calculation.subtotal,
            tax: calculation.tax,
            shippingCost: calculation.shippingCost,
            discount: calculation.discount,
            totalAmount: calculation.totalAmount,
            paymentMethod: input.paymentMethod,
            paymentStatus: input.paymentStatus,
            orderStatus: deriveOrderStatus(
                calculation.vendors.map(() => input.initialVendorStatus),
            ),
            shippingAddressId: input.shippingAddressId,
            shippingSnapshot: shippingAddress as unknown as Prisma.InputJsonValue,
            ipAddress: input.ipAddress ?? undefined,
            userAgent: input.userAgent ?? undefined,
            notes: input.notes ?? undefined,
        },
    });

    // 3. One VendorOrder per store, with its items. The commission rate is
    //    snapshotted from the calculation so a later rate change to the store
    //    never rewrites this order's split.
    for (const [index, vendor] of calculation.vendors.entries()) {
        const vendorOrder = await tx.vendorOrder.create({
            data: {
                orderId: order.id,
                vendorId: vendor.vendorId,
                vendorOrderNumber: buildVendorOrderNumber(
                    input.orderNumber,
                    index,
                ),
                subtotal: vendor.subtotal,
                tax: vendor.tax,
                shippingCost: vendor.shippingCost,
                discount: vendor.discount,
                totalAmount: vendor.totalAmount,
                commissionRate: vendor.commissionRate,
                commissionAmount: vendor.commissionAmount,
                vendorEarning: vendor.vendorEarning,
                orderStatus: input.initialVendorStatus,
                items: {
                    create: vendor.items.map((item) => ({
                        orderId: order.id,
                        vendorId: vendor.vendorId,
                        productId: item.productId,
                        productName: item.productName,
                        variantId: item.variantId,
                        variantDetails: item.variantDetails,
                        quantity: item.quantity,
                        priceAtPurchase: item.priceAtPurchase,
                        originalPrice: item.originalPrice,
                        discount: item.discount,
                        subtotal: item.subtotal,
                        taxRate: item.taxRate,
                        tax: item.tax,
                    })),
                },
            },
        });

        await logStatusChange(tx, {
            orderId: order.id,
            vendorOrderId: vendorOrder.id,
            oldStatus: OrderStatus.PENDING,
            newStatus: input.initialVendorStatus,
            userId: input.userId,
            note:
                input.initialVendorStatus === OrderStatus.PENDING
                    ? "Order placed"
                    : "Order placed — payment confirmed",
            ipAddress: input.ipAddress ?? undefined,
        });
    }

    // 4. One payment row for the whole order — the buyer is charged once, and
    //    the split lives on the vendor orders.
    await tx.payment.create({
        data: {
            orderId: order.id,
            amount: calculation.totalAmount,
            method: input.paymentMethod,
            status: input.paymentStatus,
            transactionId: input.transactionId,
            paymentGateway: input.paymentGateway,
            gatewayResponse: input.gatewayResponse,
            paidAt: input.paidAt,
        },
    });

    return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
            vendorOrders: {
                include: {
                    vendor: {
                        select: { id: true, storeName: true, slug: true, logo: true },
                    },
                    items: true,
                },
            },
            payment: true,
            shippingAddress: true,
            user: {
                select: {
                    id: true,
                    name: true,
                    auth: { select: { email: true } },
                },
            },
        },
    });
}
