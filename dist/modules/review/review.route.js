"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewRouter = void 0;
const express_1 = require("express");
const review_controller_1 = require("./review.controller");
const validateRequest_1 = require("../../middleware/validateRequest.js");
const review_validation_1 = require("./review.validation");
const authGuard_1 = require("../../middleware/authGuard.js");
const prisma_client_1 = require("../../lib/prisma-client.js");
const router = (0, express_1.Router)();
const anySignedInUser = (0, authGuard_1.authGuard)(prisma_client_1.Role.CUSTOMER, prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN);
router.get("/my-reviews", anySignedInUser, review_controller_1.reviewControllers.findByUserId);
// Above `/:id`, or Express would read "eligibility" as a review id.
router.get("/eligibility/:productId", anySignedInUser, review_controller_1.reviewControllers.getEligibility);
router.get("/product/:productId", review_controller_1.reviewControllers.findAllReviewsByProductId);
router
    .route("/:id")
    .get(review_controller_1.reviewControllers.findById)
    .patch(anySignedInUser, (0, validateRequest_1.validateRequest)(review_validation_1.reviewValidation.updateReview), review_controller_1.reviewControllers.updateData)
    .delete(anySignedInUser, review_controller_1.reviewControllers.deleteData);
router
    .route("/")
    .post(
// authGuard first: authenticate before spending work on validation.
anySignedInUser, (0, validateRequest_1.validateRequest)(review_validation_1.reviewValidation.createReview), review_controller_1.reviewControllers.createIntoDB)
    .get(review_controller_1.reviewControllers.findAllFromDB);
exports.reviewRouter = router;
