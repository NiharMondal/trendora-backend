"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderValidation = void 0;
const zod_1 = __importDefault(require("zod"));
const enum_1 = require("../../helpers/enum.js");
const orderItems = zod_1.default.array(zod_1.default.object({
    productId: zod_1.default
        .string({ error: "Product ID is required" })
        .nonempty({ error: "Product ID can not be empty" }),
    variantId: zod_1.default
        .string({ error: "Variant ID is required" })
        .nonempty({ error: "Variant ID can not be empty" })
        .optional(),
    quantity: zod_1.default.number({ error: "Quantity is required" }),
}));
/**
 * A cart may span several stores; the backend groups the items by vendor
 * itself, so the client sends one flat item list exactly as before. Nothing
 * about money or vendor ownership is accepted from the client.
 */
const createOrderSchema = zod_1.default.object({
    paymentMethod: zod_1.default.enum(["STRIPE", "CASH_ON_DELIVERY"]),
    shippingAddressId: zod_1.default
        .string()
        .optional()
        .transform((val) => val === "" || val === undefined ? undefined : val)
        .pipe(zod_1.default.uuidv4("Please select an address").optional()),
    address: zod_1.default.object({
        fullName: zod_1.default.string({ error: "Name is required" }).trim(),
        email: zod_1.default.email().trim(),
        phone: zod_1.default.string({ error: "Phone number is required" }).trim(),
        street: zod_1.default.string({ error: "Street is required" }).trim(),
        city: zod_1.default.string({ error: "City name is required" }).trim(),
        state: zod_1.default.string().trim().optional(),
        postalCode: zod_1.default.string({ error: "Postal code is required" }).trim(),
        country: zod_1.default.string({ error: "Country name is required" }).trim(),
    }).optional(),
    items: orderItems.min(1, "Order should contain one item"),
    notes: zod_1.default.string().optional(),
});
/**
 * Fulfilment happens per vendor order, so this targets a VendorOrder id.
 * `trackingNumber`/`carrier` accompany a SHIPPED transition; `cancelReason`
 * accompanies a CANCELED one.
 */
const updateVendorOrderStatusSchema = zod_1.default.object({
    orderStatus: enum_1.OrderStatusEnum,
    trackingNumber: zod_1.default.string().trim().max(120).optional(),
    carrier: zod_1.default.string().trim().max(80).optional(),
    cancelReason: zod_1.default.string().trim().max(500).optional(),
});
exports.orderValidation = {
    createOrderSchema,
    updateVendorOrderStatusSchema,
};
