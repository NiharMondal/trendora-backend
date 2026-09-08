"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWishList = void 0;
const zod_1 = __importDefault(require("zod"));
exports.createWishList = zod_1.default.object({
    userId: zod_1.default.uuidv4("UserId can not be empty"),
    productId: zod_1.default.uuidv4("ProductId can not be empty"),
});
