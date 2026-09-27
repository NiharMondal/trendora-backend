"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addressRouter = void 0;
const express_1 = require("express");
const address_controller_1 = require("./address.controller");
const validateRequest_1 = require("../../middleware/validateRequest.js");
const address_validation_1 = require("./address.validation");
const authGuard_1 = require("../../middleware/authGuard.js");
const prisma_client_1 = require("../../lib/prisma-client.js");
const router = (0, express_1.Router)();
router.get("/my-address", 
// A VENDOR is also a shopper — every buyer-facing route accepts all three
// roles, otherwise approving a seller would break their own checkout.
(0, authGuard_1.authGuard)(prisma_client_1.Role.CUSTOMER, prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN), address_controller_1.addressControllers.findMyAddress);
router
    .route("/:id")
    .get((0, authGuard_1.authGuard)(prisma_client_1.Role.CUSTOMER, prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN), address_controller_1.addressControllers.findById)
    .patch((0, authGuard_1.authGuard)(prisma_client_1.Role.CUSTOMER, prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(address_validation_1.addressSchema), address_controller_1.addressControllers.updateData)
    .delete((0, authGuard_1.authGuard)(prisma_client_1.Role.CUSTOMER, prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN), address_controller_1.addressControllers.deleteData);
router
    .route("/")
    .get((0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), address_controller_1.addressControllers.findAllFromDB)
    .post((0, authGuard_1.authGuard)(prisma_client_1.Role.CUSTOMER, prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(address_validation_1.addressSchema), address_controller_1.addressControllers.createIntoDB);
exports.addressRouter = router;
