"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wishlistRouter = void 0;
const express_1 = require("express");
const wishlist_controller_1 = require("./wishlist.controller");
const authGuard_1 = require("../../middleware/authGuard");
const prisma_1 = require("../../../generated/prisma");
const router = (0, express_1.Router)();
router
    .route("/my-wishlists")
    .post((0, authGuard_1.authGuard)(prisma_1.Role.CUSTOMER), wishlist_controller_1.wishlistControllers.createIntoDB)
    .get((0, authGuard_1.authGuard)(prisma_1.Role.CUSTOMER), wishlist_controller_1.wishlistControllers.findByUserId);
router
    .route("/:id")
    .get(wishlist_controller_1.wishlistControllers.findById)
    .delete(wishlist_controller_1.wishlistControllers.deleteData);
exports.wishlistRouter = router;
