import { PaymentMethod } from "../../generated/prisma";

export interface CartItemInput {
    productId: string;
    variantId?: string;
    quantity: number;
}

export type TCreateOrderInput = {
    userId: string;
    shippingAddressId?: string;       // optional — use existing address
    address?: {                        // optional — create new address
        fullName: string;
        phone: string;
        email: string;
        street: string;
        city: string;
        state?: string;
        postalCode: string;
        country: string;
    };
    items: CartItemInput[];
    paymentMethod: PaymentMethod;
    notes?: string;
    ipAddress?: string;
    userAgent?: string;
};

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