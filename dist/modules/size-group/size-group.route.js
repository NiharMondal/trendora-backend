"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sizeGroupRouter = void 0;
const express_1 = require("express");
const validateRequest_1 = require("../../middleware/validateRequest");
const authGuard_1 = require("../../middleware/authGuard");
const prisma_1 = require("../../../generated/prisma");
const size_group_controller_1 = require("./size-group.controller");
const size_group_validation_1 = require("./size-group.validation");
const router = (0, express_1.Router)();
router
    .route("/:id")
    .get(size_group_controller_1.sizeGroupControllers.findById)
    .patch((0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), size_group_controller_1.sizeGroupControllers.updateData)
    .delete((0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), size_group_controller_1.sizeGroupControllers.deleteData);
router
    .route("/")
    .post((0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(size_group_validation_1.sizeGroupSchema), size_group_controller_1.sizeGroupControllers.createIntoDB)
    .get(size_group_controller_1.sizeGroupControllers.findAllFromDB);
exports.sizeGroupRouter = router;
