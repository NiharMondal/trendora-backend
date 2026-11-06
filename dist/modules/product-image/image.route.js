"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productImageRouter = void 0;
const express_1 = require("express");
const prisma_client_1 = require("../../lib/prisma-client.js");
const authGuard_1 = require("../../middleware/authGuard.js");
const validateRequest_1 = require("../../middleware/validateRequest.js");
const image_controller_1 = require("./image.controller");
const image_validation_1 = require("./image.validation");
const router = (0, express_1.Router)({ mergeParams: true });
/**
 * Images as a sub-resource of a product, mounted under /products.
 *
 * The reason these are worth having rather than folding into
 * `PATCH /products/:id`: that route takes the whole images array and deletes
 * any row whose id the client did not round-trip — **destroying the Cloudinary
 * asset with it**. Removing one picture here cannot take another with it.
 *
 * The GET is public and gated by the storefront's visibility rules.
 */
router.get("/:productId/images", image_controller_1.productImageController.findByProductId);
router.post("/:productId/images", (0, authGuard_1.authGuard)(prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(image_validation_1.imageValidation.addImagesSchema), image_controller_1.productImageController.addImages);
router.patch("/:productId/images/:imageId", (0, authGuard_1.authGuard)(prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(image_validation_1.imageValidation.updateImageSchema), image_controller_1.productImageController.updateImage);
router.delete("/:productId/images/:imageId", (0, authGuard_1.authGuard)(prisma_client_1.Role.VENDOR, prisma_client_1.Role.ADMIN), image_controller_1.productImageController.deleteImage);
exports.productImageRouter = router;
