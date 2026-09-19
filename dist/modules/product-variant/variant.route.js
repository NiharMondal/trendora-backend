"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.variantRouter = void 0;
const express_1 = require("express");
const variant_controller_1 = require("./variant.controller");
const router = (0, express_1.Router)({ mergeParams: true });
router.get("/:productId/variants", variant_controller_1.variantController.findByProductId);
exports.variantRouter = router;
