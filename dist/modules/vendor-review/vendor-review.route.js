"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorReviewRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../../../generated/prisma");
const authGuard_1 = require("../../middleware/authGuard");
const validateRequest_1 = require("../../middleware/validateRequest");
const vendor_review_controller_1 = require("./vendor-review.controller");
const vendor_review_validation_1 = require("./vendor-review.validation");
const router = (0, express_1.Router)();
router.get("/my-reviews", (0, authGuard_1.authGuard)(prisma_1.Role.CUSTOMER, prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), vendor_review_controller_1.vendorReviewControllers.findMine);
router.get("/store/:slug", vendor_review_controller_1.vendorReviewControllers.findByVendorSlug);
router
    .route("/:id")
    .patch((0, authGuard_1.authGuard)(prisma_1.Role.CUSTOMER, prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(vendor_review_validation_1.vendorReviewValidation.updateVendorReviewSchema), vendor_review_controller_1.vendorReviewControllers.updateData)
    .delete((0, authGuard_1.authGuard)(prisma_1.Role.CUSTOMER, prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), vendor_review_controller_1.vendorReviewControllers.deleteData);
router.post("/", (0, authGuard_1.authGuard)(prisma_1.Role.CUSTOMER, prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(vendor_review_validation_1.vendorReviewValidation.createVendorReviewSchema), vendor_review_controller_1.vendorReviewControllers.createIntoDB);
exports.vendorReviewRouter = router;
