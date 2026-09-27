"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWishList = void 0;
const zod_1 = __importDefault(require("zod"));
/**
 * Only `productId` comes from the client. `userId` is taken from the verified
 * JWT in the controller and must never be accepted from the body — letting the
 * caller name the owner is how one account writes into another's wishlist.
 *
 * (This schema used to require `userId` too, which is why it could not be wired
 * to `validateRequest`: the frontend has never sent that field, so every
 * request would have 400'd.)
 */
exports.createWishList = zod_1.default.object({
    productId: zod_1.default.uuidv4("ProductId can not be empty"),
});
