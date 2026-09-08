"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.brandSchema = void 0;
const zod_1 = require("zod");
exports.brandSchema = zod_1.z.object({
    name: zod_1.z
        .string({ error: "Brand name is required" })
        .min(2, "Brand must be at least 2 characters long")
        .trim(),
});
