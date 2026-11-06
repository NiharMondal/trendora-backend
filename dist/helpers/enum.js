"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthProviderEnum = exports.GenderEnum = exports.CheckoutSessionStatusEnum = exports.RefundStatusEnum = exports.PayoutStatusEnum = exports.PaymentMethodEnum = exports.PaymentStatusEnum = exports.OrderStatusEnum = exports.ProductStatusEnum = exports.VendorStatusEnum = exports.RoleEnum = void 0;
const zod_1 = require("zod");
/**
 * Zod mirrors of the Prisma enums in prisma/schema.prisma.
 *
 * Enums live in three places — the Prisma schema, these mirrors, and the
 * frontend constants/types. All three must agree.
 */
exports.RoleEnum = zod_1.z.enum(["CUSTOMER", "VENDOR", "ADMIN"]);
exports.VendorStatusEnum = zod_1.z.enum([
    "PENDING",
    "APPROVED",
    "REJECTED",
    "SUSPENDED",
]);
exports.ProductStatusEnum = zod_1.z.enum([
    "DRAFT",
    "PENDING",
    "APPROVED",
    "REJECTED",
]);
exports.OrderStatusEnum = zod_1.z.enum([
    "PENDING",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELED",
]);
exports.PaymentStatusEnum = zod_1.z.enum([
    "PENDING",
    "PAID",
    "FAILED",
    "PARTIALLY_REFUNDED",
    "REFUNDED",
]);
exports.PaymentMethodEnum = zod_1.z.enum(["STRIPE", "CASH_ON_DELIVERY"]);
exports.PayoutStatusEnum = zod_1.z.enum([
    "PENDING",
    "PROCESSING",
    "PAID",
    "FAILED",
]);
exports.RefundStatusEnum = zod_1.z.enum([
    "PENDING",
    "PROCESSING",
    "SUCCEEDED",
    "FAILED",
    "CANCELED",
]);
exports.CheckoutSessionStatusEnum = zod_1.z.enum([
    "PENDING",
    "COMPLETED",
    "EXPIRED",
    "CANCELED",
]);
exports.GenderEnum = zod_1.z.enum(["MEN", "WOMEN", "KIDS", "UNISEX"]);
/**
 * The tenth mirror, and the only one that is not also the accepted input of
 * some endpoint: `EMAIL` is the stored default for password accounts, so it is
 * a valid *stored* provider but never a valid *OAuth* one. What
 * `/auth/oauth-login` accepts is a deliberate subset — see `OAUTH_PROVIDERS`
 * in `modules/auth/auth.validation.ts`.
 */
exports.AuthProviderEnum = zod_1.z.enum(["EMAIL", "GOOGLE", "FACEBOOK"]);
