"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewRouter = void 0;
const express_1 = require("express");
const review_controller_1 = require("./review.controller");
const validateRequest_1 = require("../../middleware/validateRequest");
const review_validation_1 = require("./review.validation");
const authGuard_1 = require("../../middleware/authGuard");
const prisma_1 = require("../../../generated/prisma");
const router = (0, express_1.Router)();
router.get("/my-reviews", (0, authGuard_1.authGuard)(prisma_1.Role.CUSTOMER), review_controller_1.reviewControllers.findByUserId);
router
    .route("/:id")
    .get(review_controller_1.reviewControllers.findById)
    .patch((0, validateRequest_1.validateRequest)(review_validation_1.reviewValidation.updateReview), review_controller_1.reviewControllers.updateData)
    .delete(review_controller_1.reviewControllers.deleteData);
router
    .route("/")
    .post((0, validateRequest_1.validateRequest)(review_validation_1.reviewValidation.createReview), review_controller_1.reviewControllers.createIntoDB)
    .get(review_controller_1.reviewControllers.findAllFromDB);
exports.reviewRouter = router;
