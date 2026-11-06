"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinaryRouter = void 0;
const express_1 = require("express");
const validateRequest_1 = require("../../middleware/validateRequest.js");
const cloudinary_controller_1 = require("./cloudinary.controller");
const cloudinary_validation_1 = require("./cloudinary.validation");
const router = (0, express_1.Router)();
/**
 * Deliberately unauthenticated: the frontend's `deleteTempImage` is a raw
 * `fetch` with no token, one of the two exceptions to "all server data goes
 * through RTK Query". Adding `authGuard` here alone turns every image replace
 * into a silent 401 — it is a two-sided change (BE-04 / BE-42).
 */
router.post("/delete-temp", (0, validateRequest_1.validateRequest)(cloudinary_validation_1.cloudinaryValidation.deleteTempSchema), cloudinary_controller_1.cloudinaryControllers.deleteTempImage);
exports.cloudinaryRouter = router;
