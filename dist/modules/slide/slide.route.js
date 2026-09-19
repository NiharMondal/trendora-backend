"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slideRouter = void 0;
const express_1 = require("express");
const validateRequest_1 = require("../../middleware/validateRequest");
const authGuard_1 = require("../../middleware/authGuard");
const prisma_1 = require("../../../generated/prisma");
const slide_controller_1 = require("./slide.controller");
const slide_validation_1 = require("./slide.validation");
const router = (0, express_1.Router)();
router
    .route("/:id")
    .get(slide_controller_1.slideControllers.findById)
    .patch((0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), slide_controller_1.slideControllers.updateData)
    .delete((0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), slide_controller_1.slideControllers.deleteData);
router
    .route("/")
    .post((0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(slide_validation_1.slideSchema), slide_controller_1.slideControllers.createIntoDB)
    .get(slide_controller_1.slideControllers.findAllFromDB);
exports.slideRouter = router;
