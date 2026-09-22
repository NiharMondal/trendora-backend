"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.variantRouter = void 0;
const express_1 = require("express");
const prisma_client_1 = require("../../lib/prisma-client.js");
const authGuard_1 = require("../../middleware/authGuard.js");
const validateRequest_1 = require("../../middleware/validateRequest.js");
const variant_controller_1 = require("./variant.controller");
const variant_validation_1 = require("./variant.validation");
const router = (0, express_1.Router)({ mergeParams: true });
/**
 * Variants as a sub-resource of a product, mounted under /products.
 *
 * These exist so a vendor can restock, reprice or add a size without resending
 * the whole product: `PATCH /products/:id` replaces both collections wholesale
 * and deletes any row whose id the client failed to round-trip. Editing one
 * line here cannot touch the others.
 *
 * The GET is public and gated by the storefront's visibility rules, so it
 * cannot become a side door onto a draft listing's pricing. A vendor reads
 * their own unpublished listing through /products/vendor/my-products/:id,
 * which returns variants and images nested.
 */
router.get("/:productId/variants", variant_controller_1.variantController.findByProductId);
router.post("/:productId/variants", (0, authGuard_1.authGuard)(prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(variant_validation_1.variantValidation.addVariantsSchema), variant_controller_1.variantController.addVariants);
router.patch("/:productId/variants/:variantId", (0, authGuard_1.authGuard)(prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(variant_validation_1.variantValidation.updateVariantSchema), variant_controller_1.variantController.updateVariant);
router.delete("/:productId/variants/:variantId", (0, authGuard_1.authGuard)(prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN), variant_controller_1.variantController.deleteVariant);
exports.variantRouter = router;
