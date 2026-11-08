"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinaryValidation = exports.deleteTempSchema = void 0;
const zod_1 = require("zod");
/**
 * The module had no schema at all, so `publicId` was read straight off
 * `req.body`: a request without it threw a TypeError on `.includes` and
 * returned a 500 instead of a 400.
 */
exports.deleteTempSchema = zod_1.z.object({
    publicId: zod_1.z
        .string({ error: "publicId is required" })
        .nonempty("publicId is required"),
});
exports.cloudinaryValidation = { deleteTempSchema: exports.deleteTempSchema };
