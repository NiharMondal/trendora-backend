"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.brandRouter = void 0;
const express_1 = require("express");
const validateRequest_1 = require("../../middleware/validateRequest");
const brand_controller_1 = require("./brand.controller");
const brand_validation_1 = require("./brand.validation");
const authGuard_1 = require("../../middleware/authGuard");
const prisma_1 = require("../../../generated/prisma");
const router = (0, express_1.Router)();
router
    .route("/:id")
    .get(brand_controller_1.brandControllers.findById)
    .patch((0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), brand_controller_1.brandControllers.updateData)
    .delete((0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), brand_controller_1.brandControllers.deleteData);
router
    .route("/")
    .post((0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(brand_validation_1.brandSchema), brand_controller_1.brandControllers.createIntoDB)
    .get(brand_controller_1.brandControllers.findAllFromDB);
exports.brandRouter = router;
