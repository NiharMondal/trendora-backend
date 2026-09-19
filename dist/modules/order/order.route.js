"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderRouter = void 0;
const express_1 = require("express");
const order_controller_1 = require("./order.controller");
const validateRequest_1 = require("../../middleware/validateRequest");
const order_validation_1 = require("./order.validation");
const authGuard_1 = require("../../middleware/authGuard");
const prisma_1 = require("../../../generated/prisma");
const router = (0, express_1.Router)();
/**
 * Fulfilment is per VENDOR ORDER, so the status route targets a vendorOrderId.
 * The old `PATCH /orders/:orderId/status` is gone: with several vendors on one
 * order there is no single status to set, and it was unauthenticated.
 */
// -------------------------------------------------------------------- customer
router.get("/my-orders", (0, authGuard_1.authGuard)(prisma_1.Role.CUSTOMER, prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), order_controller_1.orderControllers.getMyOrders);
// ---------------------------------------------------------------------- vendor
router.get("/vendor/my-orders", (0, authGuard_1.authGuard)(prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), order_controller_1.orderControllers.getMyVendorOrders);
router.get("/vendor/my-orders/:vendorOrderId", (0, authGuard_1.authGuard)(prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), order_controller_1.orderControllers.getVendorOrderById);
router.patch("/vendor-orders/:vendorOrderId/status", (0, authGuard_1.authGuard)(prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(order_validation_1.orderValidation.updateVendorOrderStatusSchema), order_controller_1.orderControllers.updateVendorOrderStatus);
// ----------------------------------------------------------------------- admin
router.get("/analytics", (0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), order_controller_1.orderControllers.getDashboardAnalytics);
// ------------------------------------------------------------------- shared
router
    .route("/:orderId")
    .get(
// Authorisation is by relationship inside the service: the buyer, an
// admin, or a vendor with a slice of this order.
(0, authGuard_1.authGuard)(prisma_1.Role.CUSTOMER, prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), order_controller_1.orderControllers.getOrderById);
router
    .route("/")
    .post((0, authGuard_1.authGuard)(prisma_1.Role.CUSTOMER, prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(order_validation_1.orderValidation.createOrderSchema), order_controller_1.orderControllers.createOrder)
    .get((0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), order_controller_1.orderControllers.findAllFromDB);
exports.orderRouter = router;
