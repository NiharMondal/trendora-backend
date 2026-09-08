"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.slideSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.slideSchema = zod_1.default.object({
    title: zod_1.default
        .string()
        .min(5, "Title should contain at least 5 characters")
        .max(30, "Title should contain at least 30 characters")
        .trim(),
    subtitle: zod_1.default
        .string()
        .min(20, "Subtitle should contain at least 20 characters")
        .trim(),
    photoUrl: zod_1.default
        .string({ error: "Photo url is required!" })
        .nonempty({ error: "Photo url is required!" }),
    url: zod_1.default
        .string({ error: "URL link is required!" })
        .nonempty({ error: "URL link is required!" }),
});
