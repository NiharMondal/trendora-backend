import { NextFunction, Request, Response } from "express";
import { Prisma } from "@/lib/prisma-client";
import { ZodError } from "zod";

export const globalErrorHandler = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error: any,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: NextFunction
) => {
    const errorResponse = {
        statusCode: error?.statusCode || 500,
        message: error?.message || "Something went wrong",
        errorDetails: error,
    };

    if (error instanceof ZodError) {
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

    if (error instanceof Prisma.PrismaClientValidationError) {
        errorResponse.statusCode = 400;
        errorResponse.message = error.name;
        const match = error.message.match(
            /Argument\s+`[^`]+`\s+is\s+missing\./
        );
        const result = match ? match[0] : null;

        errorResponse.errorDetails = result;
        console.log(error)
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
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
        // A Restrict foreign key refusing a delete. Reachable since the two
        // required FKs stopped claiming SetNull (BE-39): deleting a size group
        // that still has sizes, or an address an order points at, is now a
        // clean refusal instead of a 500.
        if (error.code === "P2003") {
            errorResponse.statusCode = 409;
            errorResponse.message =
                "This record is still referenced by other data and cannot be deleted";
            errorResponse.errorDetails = "Foreign key constraint failed";
        }
    }

    res.status(errorResponse.statusCode).json({
        success: false,
        message: errorResponse.message,
        errorDetails: errorResponse.errorDetails,
    });
};
