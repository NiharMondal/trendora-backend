"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productImageRouter = void 0;
const express_1 = require("express");
const image_controller_1 = require("./image.controller");
const router = (0, express_1.Router)({ mergeParams: true });
router.get("/:productId/images", image_controller_1.productImageController.findByProductId);
exports.productImageRouter = router;
