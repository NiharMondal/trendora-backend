"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sizeSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.sizeSchema = zod_1.default.object({
    name: zod_1.default.string("Name is required").min(1, "Min length is 1").trim(),
    sizeGroupId: zod_1.default.string("Size group ID is required")
});
