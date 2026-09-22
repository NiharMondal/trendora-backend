"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payoutRouter = void 0;
const express_1 = require("express");
const prisma_client_1 = require("../../lib/prisma-client.js");
const authGuard_1 = require("../../middleware/authGuard.js");
const validateRequest_1 = require("../../middleware/validateRequest.js");
const payout_controller_1 = require("./payout.controller");
const payout_validation_1 = require("./payout.validation");
const router = (0, express_1.Router)();
// ---------------------------------------------------------------------- vendor
router.get("/me/balance", (0, authGuard_1.authGuard)(prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN), payout_controller_1.payoutControllers.getMyBalance);
router.get("/me", (0, authGuard_1.authGuard)(prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN), payout_controller_1.payoutControllers.getMyPayouts);
// ----------------------------------------------------------------------- admin
router.get("/admin/outstanding", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), payout_controller_1.payoutControllers.getOutstandingBalances);
router.get("/admin/all", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), payout_controller_1.payoutControllers.findAllForAdmin);
router.post("/generate", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(payout_validation_1.payoutValidation.generatePayoutSchema), payout_controller_1.payoutControllers.generatePayout);
router.patch("/:id/mark-paid", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(payout_validation_1.payoutValidation.markPaidSchema), payout_controller_1.payoutControllers.markPaid);
router.patch("/:id/mark-failed", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(payout_validation_1.payoutValidation.markFailedSchema), payout_controller_1.payoutControllers.markFailed);
// Vendor or admin; the service checks ownership.
router.get("/:id", (0, authGuard_1.authGuard)(prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN), payout_controller_1.payoutControllers.findById);
exports.payoutRouter = router;
