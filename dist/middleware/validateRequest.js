"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const validateRequest = (schema) => {
    return (0, asyncHandler_1.asyncHandler)(async (req, res, next) => {
        const result = await schema.safeParseAsync(req.body);
        if (!result.success) {
            next(result.error);
        }
        else {
            req.body = result.data;
            next();
        }
    });
};
exports.validateRequest = validateRequest;
