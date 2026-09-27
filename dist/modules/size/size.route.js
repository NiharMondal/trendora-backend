"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sizeRouter = void 0;
const express_1 = require("express");
const validateRequest_1 = require("../../middleware/validateRequest.js");
const authGuard_1 = require("../../middleware/authGuard.js");
const prisma_client_1 = require("../../lib/prisma-client.js");
const size_controller_1 = require("./size.controller");
const size_validation_1 = require("./size.validation");
const router = (0, express_1.Router)();
router
    .route("/:id")
    .get(size_controller_1.sizeControllers.findById)
    .patch((0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(size_validation_1.sizeSchema), size_controller_1.sizeControllers.updateData)
    .delete((0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), size_controller_1.sizeControllers.deleteData);
router
    .route("/")
    .post((0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(size_validation_1.sizeSchema), size_controller_1.sizeControllers.createIntoDB)
    .get(size_controller_1.sizeControllers.findAllFromDB);
exports.sizeRouter = router;
