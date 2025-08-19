"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addressRouter = void 0;
const express_1 = require("express");
const address_controller_1 = require("./address.controller");
const validateRequest_1 = require("../../middleware/validateRequest");
const address_validation_1 = require("./address.validation");
const authGuard_1 = require("../../middleware/authGuard");
const prisma_1 = require("../../../generated/prisma");
const router = (0, express_1.Router)();
router.get("/my-address", (0, authGuard_1.authGuard)(prisma_1.Role.CUSTOMER), address_controller_1.addressControllers.findAddressByUserId);
router
    .route("/:id")
    .get(address_controller_1.addressControllers.findById)
    .patch((0, validateRequest_1.validateRequest)(address_validation_1.addressValidation.updateAddress), address_controller_1.addressControllers.updateData)
    .delete(address_controller_1.addressControllers.deleteData);
router
    .route("/")
    .post((0, validateRequest_1.validateRequest)(address_validation_1.addressValidation.createAddress), address_controller_1.addressControllers.createIntoDB);
exports.addressRouter = router;
