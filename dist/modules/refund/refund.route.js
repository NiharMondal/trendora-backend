"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refundRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../../../generated/prisma");
const authGuard_1 = require("../../middleware/authGuard");
const validateRequest_1 = require("../../middleware/validateRequest");
const refund_controller_1 = require("./refund.controller");
const refund_validation_1 = require("./refund.validation");
const router = (0, express_1.Router)();
/**
 * Refunds are issued automatically when a paid parcel is cancelled. These
 * endpoints cover what automation cannot: retrying a gateway failure,
 * recording money returned by hand, and abandoning a refund.
 *
 * Every mutation is ADMIN-only — moving money back to a buyer is not a seller
 * decision, and a seller cancelling a parcel already triggers the refund.
 */
// ------------------------------------------------------- buyer / seller reads
router.get("/me", 
// A buyer sees refunds on their orders; a vendor sees refunds on their own
// parcels. The service picks the scope from the role.
(0, authGuard_1.authGuard)(prisma_1.Role.CUSTOMER, prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), refund_controller_1.refundControllers.findMine);
// ----------------------------------------------------------------------- admin
router.get("/admin/outstanding", (0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), refund_controller_1.refundControllers.getOutstanding);
router.get("/admin/all", (0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), refund_controller_1.refundControllers.findAllForAdmin);
router.post("/manual", (0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(refund_validation_1.refundValidation.manualRefundSchema), refund_controller_1.refundControllers.manual);
router.post("/retry-all", (0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), refund_controller_1.refundControllers.retryAll);
router.patch("/:id/retry", (0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), refund_controller_1.refundControllers.retry);
router.patch("/:id/cancel", (0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(refund_validation_1.refundValidation.cancelRefundSchema), refund_controller_1.refundControllers.cancel);
router.get("/:id", (0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), refund_controller_1.refundControllers.findById);
exports.refundRouter = router;
