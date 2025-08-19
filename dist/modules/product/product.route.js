"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productRouter = void 0;
const express_1 = require("express");
const product_controller_1 = require("./product.controller");
const router = (0, express_1.Router)();
router.get("/by-slug/:slug", product_controller_1.productControllers.findBySlug);
router
    .route("/:id")
    .get(product_controller_1.productControllers.findById)
    .patch(product_controller_1.productControllers.updateData)
    .delete(product_controller_1.productControllers.deleteData);
router
    .route("/")
    .post(product_controller_1.productControllers.createIntoDB)
    .get(product_controller_1.productControllers.findAllFromDB);
exports.productRouter = router;
