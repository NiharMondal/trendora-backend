import { PaymentMethod } from "../../generated/prisma";

export interface CartItemInput {
    productId: string;
    variantId?: string;
    quantity: number;
    // NOTE: NO PRICE - we fetch from database!
}

export interface CreateOrderInput {
    userId: string;
    items: CartItemInput[];
    shippingAddressId: string;
    paymentMethod: PaymentMethod;
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
    discount: number;
    subtotal: number;
}

export interface OrderCalculation {
    items: ValidatedOrderItem[];
    subtotal: number;
    tax: number;
    shippingCost: number;
    discount: number;
    totalAmount: number;
}