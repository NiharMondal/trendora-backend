import { z } from "zod";

/**
 * Zod mirrors of the Prisma enums in prisma/schema.prisma.
 *
 * Enums live in three places — the Prisma schema, these mirrors, and the
 * frontend constants/types. All three must agree.
 */

export const RoleEnum = z.enum(["CUSTOMER", "VENDOR", "ADMIN"]);

export const VendorStatusEnum = z.enum([
    "PENDING",
    "APPROVED",
    "REJECTED",
    "SUSPENDED",
]);

export const ProductStatusEnum = z.enum([
    "DRAFT",
    "PENDING",
    "APPROVED",
    "REJECTED",
]);

export const OrderStatusEnum = z.enum([
    "PENDING",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELED",
]);

export const PaymentStatusEnum = z.enum([
    "PENDING",
    "PAID",
    "FAILED",
    "REFUNDED",
]);

export const PaymentMethodEnum = z.enum(["STRIPE", "CASH_ON_DELIVERY"]);

export const PayoutStatusEnum = z.enum([
    "PENDING",
    "PROCESSING",
    "PAID",
    "FAILED",
]);

export const CheckoutSessionStatusEnum = z.enum([
    "PENDING",
    "COMPLETED",
    "EXPIRED",
    "CANCELED",
]);

export const GenderEnum = z.enum(["MEN", "WOMEN", "KIDS", "UNISEX"]);
