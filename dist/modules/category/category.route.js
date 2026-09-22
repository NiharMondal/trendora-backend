"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryRouter = void 0;
const express_1 = require("express");
const category_controller_1 = require("./category.controller");
const validateRequest_1 = require("../../middleware/validateRequest.js");
const category_validation_1 = require("./category.validation");
const authGuard_1 = require("../../middleware/authGuard.js");
const prisma_client_1 = require("../../lib/prisma-client.js");
const router = (0, express_1.Router)();
router
    .route("/:id")
    .get(category_controller_1.categoryControllers.findById)
    .patch((0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(category_validation_1.categoryUpdateSchema), category_controller_1.categoryControllers.updateData)
    .delete((0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), category_controller_1.categoryControllers.deleteData);
router
    .route("/")
    .post((0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(category_validation_1.categorySchema), category_controller_1.categoryControllers.createIntoDB)
    .get(category_controller_1.categoryControllers.findAllFromDB);
exports.categoryRouter = router;
