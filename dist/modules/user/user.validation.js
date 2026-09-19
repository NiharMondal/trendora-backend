"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userUpdateSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.userUpdateSchema = zod_1.default.object({
    name: zod_1.default.string("Full name is required").min(5, "Minimum 5 length is required"),
    phone: zod_1.default.string().min(1, "Contact number is required"),
    avatar: zod_1.default
        .object({
        url: zod_1.default.string().optional(),
        publicId: zod_1.default.string().optional(),
    })
        .optional(),
});
