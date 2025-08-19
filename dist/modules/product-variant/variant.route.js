"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.variantRouter = void 0;
const express_1 = require("express");
const variant_controller_1 = require("./variant.controller");
const validateRequest_1 = require("../../middleware/validateRequest");
const variant_validation_1 = require("./variant.validation");
const router = (0, express_1.Router)({ mergeParams: true });
router
    .route("/:productId/variants")
    .get(variant_controller_1.variantController.findByProductId)
    .post((0, validateRequest_1.validateRequest)(variant_validation_1.variantValidation.addVariants), variant_controller_1.variantController.addVariants);
exports.variantRouter = router;
