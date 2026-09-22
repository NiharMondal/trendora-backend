"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slideRouter = void 0;
const express_1 = require("express");
const validateRequest_1 = require("../../middleware/validateRequest.js");
const authGuard_1 = require("../../middleware/authGuard.js");
const prisma_client_1 = require("../../lib/prisma-client.js");
const slide_controller_1 = require("./slide.controller");
const slide_validation_1 = require("./slide.validation");
const router = (0, express_1.Router)();
/**
 * MUST stay above `/:id`, or Express matches "admin" as an id.
 *
 * The public `GET /` hides deactivated slides, so an admin needs its own
 * listing to find them again — same split as `/products/admin/all`.
 */
router.get("/admin/all", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), slide_controller_1.slideControllers.findAllForAdmin);
router
    .route("/:id")
    .get(slide_controller_1.slideControllers.findById)
    .patch((0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), slide_controller_1.slideControllers.updateData)
    .delete((0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), slide_controller_1.slideControllers.deleteData);
router
    .route("/")
    .post((0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), (0, validateRequest_1.validateRequest)(slide_validation_1.slideSchema), slide_controller_1.slideControllers.createIntoDB)
    .get(slide_controller_1.slideControllers.findAllFromDB);
exports.slideRouter = router;
