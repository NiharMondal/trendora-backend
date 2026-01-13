import { z } from "zod";

export const RoleEnum = z.enum(["CUSTOMER", "ADMIN"]);

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
