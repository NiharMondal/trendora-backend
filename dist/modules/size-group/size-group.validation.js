"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sizeGroupSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.sizeGroupSchema = zod_1.default.object({
    name: zod_1.default
        .string({ error: "Name is required" })
        .nonempty({ error: "Name is required" })
        .trim(),
});
