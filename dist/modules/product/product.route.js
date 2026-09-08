"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../../../generated/prisma");
const authGuard_1 = require("../../middleware/authGuard");
const validateRequest_1 = require("../../middleware/validateRequest");
const product_controller_1 = require("./product.controller");
const product_validation_1 = require("./product.validation");
const router = (0, express_1.Router)();
/**
 * Literal segments are declared before `/:id` so Express does not match
 * "vendor" or "admin" as a product id.
 *
 * Before the marketplace conversion every write here was UNAUTHENTICATED —
 * anyone could create, edit or delete any product. Writes are now
 * role-guarded, and the service additionally checks row ownership: a VENDOR
 * may only touch their own listings.
 */
// ---------------------------------------------------------------------- public
router.get("/new-arrival", product_controller_1.productControllers.newArrivalProducts);
router.get("/by-slug/:slug", product_controller_1.productControllers.findBySlug);
router.get("/related-products/:id", product_controller_1.productControllers.relatedProducts);
router.get("/store/:slug", product_controller_1.productControllers.findByVendorSlug);
// ------------------------------------------------------------- vendor (own)
router.get("/vendor/my-products", (0, authGuard_1.authGuard)(prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), product_controller_1.productControllers.findMyProducts);
router.get("/vendor/my-products/:id", (0, authGuard_1.authGuard)(prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), product_controller_1.productControllers.findMyProductById);
router.patch("/:id/submit", (0, authGuard_1.authGuard)(prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), product_controller_1.productControllers.submitForReview);
router.patch("/:id/publish", (0, authGuard_1.authGuard)(prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(product_validation_1.productValidation.publishProductSchema), product_controller_1.productControllers.setPublished);
// ----------------------------------------------------------------------- admin
router.get("/admin/all", (0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), product_controller_1.productControllers.findAllForAdmin);
router.patch("/:id/approve", (0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), product_controller_1.productControllers.approveProduct);
router.patch("/:id/reject", (0, authGuard_1.authGuard)(prisma_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(product_validation_1.productValidation.rejectProductSchema), product_controller_1.productControllers.rejectProduct);
// ------------------------------------------------------------------ crud
router
    .route("/:id")
    .get(product_controller_1.productControllers.findById)
    .patch((0, authGuard_1.authGuard)(prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(product_validation_1.productValidation.updateProductSchema), product_controller_1.productControllers.updateData)
    .delete((0, authGuard_1.authGuard)(prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), product_controller_1.productControllers.deleteData);
router
    .route("/")
    .post((0, authGuard_1.authGuard)(prisma_1.Role.VENDOR, prisma_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(product_validation_1.productValidation.productSchema), product_controller_1.productControllers.createIntoDB)
    .get(product_controller_1.productControllers.findAllFromDB);
exports.productRouter = router;
