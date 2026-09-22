"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wishlistRouter = void 0;
const express_1 = require("express");
const wishlist_controller_1 = require("./wishlist.controller");
const authGuard_1 = require("../../middleware/authGuard");
const validateRequest_1 = require("../../middleware/validateRequest");
const prisma_1 = require("../../../generated/prisma");
const wishlist_validation_1 = require("./wishlist.validation");
const router = (0, express_1.Router)();
/**
 * A VENDOR is also a shopper, so every buyer-facing route accepts all three
 * roles — otherwise approving a seller would break their own wishlist and
 * checkout.
 */
const anySignedInUser = (0, authGuard_1.authGuard)(prisma_1.Role.CUSTOMER, prisma_1.Role.VENDOR, prisma_1.Role.ADMIN);
router.get("/my-wishlist", anySignedInUser, wishlist_controller_1.wishlistControllers.findByUserId);
router
    .route("/:id")
    .get(anySignedInUser, wishlist_controller_1.wishlistControllers.findById)
    .delete(anySignedInUser, wishlist_controller_1.wishlistControllers.deleteData);
router.post("/", anySignedInUser, (0, validateRequest_1.validateRequest)(wishlist_validation_1.createWishList), wishlist_controller_1.wishlistControllers.createIntoDB);
exports.wishlistRouter = router;
