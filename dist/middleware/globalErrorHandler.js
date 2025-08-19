"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = void 0;
const prisma_1 = require("../../generated/prisma");
const zod_1 = require("zod");
const globalErrorHandler = (error, req, res, next) => {
    const errorResponse = {
        statusCode: error?.statusCode || 500,
        message: error?.message || "Something went wrong",
        errorDetails: error,
    };
    if (error instanceof zod_1.ZodError) {
        if (error.issues.length > 0) {
            let errors = [];
            errors = error.issues.map((issue) => ({
                path: issue.path[0],
                message: issue.message,
            }));
            errorResponse.statusCode = 400;
            errorResponse.message = "Validation error";
            errorResponse.errorDetails = errors;
        }
    }
    if (error instanceof prisma_1.Prisma.PrismaClientValidationError) {
        errorResponse.statusCode = 400;
        errorResponse.message = error.name;
        const match = error.message.match(/Argument\s+`[^`]+`\s+is\s+missing\./);
        const result = match ? match[0] : null;
        errorResponse.errorDetails = result;
    }
    if (error instanceof prisma_1.Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
            errorResponse.statusCode = 400;
            errorResponse.message = "Duplicate key error";
            errorResponse.errorDetails = "Already exist!";
        }
        if (error.code === "P2025") {
            errorResponse.statusCode = 400;
            errorResponse.message = "Invalid UUID or not found";
            errorResponse.errorDetails = "No record was found";
        }
    }
    res.status(errorResponse.statusCode).json({
        success: false,
        message: errorResponse.message,
        errorDetails: errorResponse.errorDetails,
    });
};
exports.globalErrorHandler = globalErrorHandler;
