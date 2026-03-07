import { Address, PaymentMethod } from "../../generated/prisma";

export interface CartItemInput {
    productId: string;
    variantId?: string;
    quantity: number;
}

export interface CreateOrderInput {
    userId: string;
    items: CartItemInput[];
    shippingAddressId: string;
    paymentMethod: PaymentMethod;
    address?: Address
    notes?: string;
    ipAddress?: string;
    userAgent?: string;
}

export interface ValidatedOrderItem {
    productId: string;
    productName: string;
    variantId?: string;
    variantDetails?: string;
    quantity: number;
    priceAtPurchase: number;
    originalPrice: number;
    subtotal: number;
}

export interface OrderCalculation {
    items: ValidatedOrderItem[];
    subtotal: number;
    tax: number;
    shippingCost: number;
    totalAmount: number;
}