"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryRouter = void 0;
const express_1 = require("express");
const category_controller_1 = require("./category.controller");
const router = (0, express_1.Router)();
router
    .route("/:id")
    .get(category_controller_1.categoryControllers.findById)
    .patch(category_controller_1.categoryControllers.updateData)
    .delete(category_controller_1.categoryControllers.deleteData);
router
    .route("/")
    .post(category_controller_1.categoryControllers.createIntoDB)
    .get(category_controller_1.categoryControllers.findAllFromDB);
exports.categoryRouter = router;
