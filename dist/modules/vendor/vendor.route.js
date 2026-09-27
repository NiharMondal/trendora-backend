"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorRouter = void 0;
const express_1 = require("express");
const prisma_client_1 = require("../../lib/prisma-client.js");
const authGuard_1 = require("../../middleware/authGuard.js");
const validateRequest_1 = require("../../middleware/validateRequest.js");
const vendor_controller_1 = require("./vendor.controller");
const vendor_validation_1 = require("./vendor.validation");
const router = (0, express_1.Router)();
/**
 * Route order matters: the literal `/me` and `/admin` segments are declared
 * before `/:slug`, otherwise Express would match "me" as a store slug.
 */
// ------------------------------------------------------------------ seller self
router.post("/apply", 
// A CUSTOMER applies; an existing VENDOR is rejected by the service, and an
// ADMIN may open a store too (their role is preserved on approval).
(0, authGuard_1.authGuard)(prisma_client_1.Role.CUSTOMER, prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(vendor_validation_1.vendorValidation.applySchema), vendor_controller_1.vendorControllers.applyForVendor);
router
    .route("/me")
    .get((0, authGuard_1.authGuard)(prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN, prisma_client_1.Role.CUSTOMER), vendor_controller_1.vendorControllers.getMyStore)
    .patch((0, authGuard_1.authGuard)(prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(vendor_validation_1.vendorValidation.updateMyStoreSchema), vendor_controller_1.vendorControllers.updateMyStore);
router.get("/me/dashboard", (0, authGuard_1.authGuard)(prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN), vendor_controller_1.vendorControllers.getMyDashboard);
// ----------------------------------------------------------------------- admin
router.get("/admin/all", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), vendor_controller_1.vendorControllers.findAllForAdmin);
router.get("/admin/:id", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), vendor_controller_1.vendorControllers.findByIdForAdmin);
router.patch("/:id/approve", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), vendor_controller_1.vendorControllers.approveVendor);
router.patch("/:id/reject", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(vendor_validation_1.vendorValidation.rejectVendorSchema), vendor_controller_1.vendorControllers.rejectVendor);
router.patch("/:id/suspend", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(vendor_validation_1.vendorValidation.suspendVendorSchema), vendor_controller_1.vendorControllers.suspendVendor);
router.patch("/:id/reinstate", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), vendor_controller_1.vendorControllers.reinstateVendor);
router.patch("/:id/settings", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(vendor_validation_1.vendorValidation.updateVendorSettingsSchema), vendor_controller_1.vendorControllers.updateVendorSettings);
router.delete("/:id", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), vendor_controller_1.vendorControllers.deleteVendor);
// ---------------------------------------------------------------------- public
router.get("/", vendor_controller_1.vendorControllers.findAllPublic);
router.get("/:slug", vendor_controller_1.vendorControllers.findBySlug);
exports.vendorRouter = router;
