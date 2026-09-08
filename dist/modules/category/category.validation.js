"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categorySchema = void 0;
const zod_1 = require("zod");
exports.categorySchema = zod_1.z.object({
    name: zod_1.z
        .string("Category name is required")
        .nonempty("Category name is required")
        .min(2, "Category must be at least 2 characters long")
        .trim(),
    parentId: zod_1.z.string().nullish().nullable(),
    sizeGroupId: zod_1.z.string().nullish().nullable(),
});
