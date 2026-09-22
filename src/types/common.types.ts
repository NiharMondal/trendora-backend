import { PaymentMethod } from "@/lib/prisma-client";

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
    /** Owning store — carried through to OrderItem.vendorId. */
    vendorId: string;
    variantId?: string;
    variantDetails?: string;
    quantity: number;
    /** What the buyer actually pays per unit (discount already applied). */
    priceAtPurchase: number;
    /** List price per unit, before any discount. */
    originalPrice: number;
    /** Informational: (originalPrice - priceAtPurchase) * quantity. */
    discount: number;
    /** priceAtPurchase * quantity. */
    subtotal: number;
}

/**
 * One vendor's slice of a priced cart. Becomes exactly one VendorOrder row.
 *
 * Money invariants — these are asserted in validateAndCalculateOrder and must
 * match both the SQL backfill in the multi-vendor migration and the frontend
 * copy in frontend/src/features/cart/utils/calculate-order-total.ts:
 *
 *   subtotal     = Σ item.subtotal                (discount already baked in)
 *   shippingCost = subtotal >= vendor.freeShippingThreshold ? 0 : vendor.shippingFee
 *   tax          = round2(subtotal * TAX_RATE)
 *   totalAmount  = subtotal + tax + shippingCost
 *
 *   commissionAmount = round2(subtotal * commissionRate)   // platform's cut
 *   vendorEarning    = subtotal + shippingCost - commissionAmount
 *
 * so `commissionAmount + vendorEarning == subtotal + shippingCost == totalAmount - tax`.
 * Tax is collected by the platform and never paid out to the vendor; shipping
 * belongs to the vendor who ships.
 */
export interface VendorOrderCalculation {
    vendorId: string;
    vendorSlug: string;
    storeName: string;
    items: ValidatedOrderItem[];
    subtotal: number;
    tax: number;
    shippingCost: number;
    discount: number;
    totalAmount: number;
    commissionRate: number;
    commissionAmount: number;
    vendorEarning: number;
}

/**
 * A fully priced cart, grouped by vendor. `vendors` is the source of truth;
 * the top-level money fields are the sums of the groups, and `items` is the
 * flattened item list (used for Stripe line items and nothing else).
 */
export interface OrderCalculation {
    vendors: VendorOrderCalculation[];
    items: ValidatedOrderItem[];
    subtotal: number;
    tax: number;
    shippingCost: number;
    discount: number;
    totalAmount: number;
}
