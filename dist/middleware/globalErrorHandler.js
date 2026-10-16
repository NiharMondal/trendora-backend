"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = void 0;
const prisma_client_1 = require("../lib/prisma-client.js");
const customError_1 = __importDefault(require("../utils/customError.js"));
const zod_1 = require("zod");
const GENERIC_MESSAGE = "Something went wrong";
/**
 * The response body is built from an ALLOWLIST, never from the thrown value.
 *
 * Only a `CustomError` (thrown on purpose, with a message written for the
 * client), a `ZodError`, the mapped Prisma codes, JWT failures and the 4xx
 * errors Express's body parser marks `expose` get a specific message. Anything
 * else is an unexpected failure: the client gets a generic 500 with
 * `errorDetails: null`, and the full error is logged here instead. Returning
 * the thrown object (or even its `.message`) sent Prisma's `meta` and
 * `clientVersion`, query fragments and runtime messages to the browser (BE-06).
 */
const toErrorResponse = (error) => {
    if (error instanceof customError_1.default) {
        return {
            statusCode: error.statusCode,
            message: error.message,
            errorDetails: null,
        };
    }
    if (error instanceof zod_1.ZodError) {
        return {
            statusCode: 400,
            message: "Validation error",
            errorDetails: error.issues.map((issue) => ({
                path: issue.path[0],
                message: issue.message,
            })),
        };
    }
    if (error instanceof prisma_client_1.Prisma.PrismaClientValidationError) {
        const match = error.message.match(/Argument\s+`[^`]+`\s+is\s+missing\./);
        return {
            statusCode: 400,
            message: "Invalid request data",
            errorDetails: match ? match[0] : null,
        };
    }
    if (error instanceof prisma_client_1.Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
            return {
                statusCode: 400,
                message: "Duplicate key error",
                errorDetails: "Already exist!",
            };
        }
        if (error.code === "P2025") {
            return {
                statusCode: 404,
                message: "Record not found",
                errorDetails: "No record was found",
            };
        }
        // A Restrict foreign key refusing a delete. Reachable since the two
        // required FKs stopped claiming SetNull (BE-39): deleting a size group
        // that still has sizes, or an address an order points at, is now a
        // clean refusal instead of a 500.
        if (error.code === "P2003") {
            return {
                statusCode: 409,
                message: "This record is still referenced by other data and cannot be deleted",
                errorDetails: "Foreign key constraint failed",
            };
        }
        // Any other code is unexpected — fall through to the generic 500.
    }
    // `authGuard` converts only TokenExpiredError. A malformed or forged token
    // (`JsonWebTokenError`: "invalid signature", "jwt malformed") used to reach
    // here with no status and become a 500, which the frontend's refresh-and-
    // retry never handles — it only reacts to 401.
    if (error instanceof Error &&
        ["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name)) {
        return {
            statusCode: 401,
            message: "Invalid or expired access token",
            errorDetails: null,
        };
    }
    // Express's body parser (malformed JSON, body over the size cap) throws
    // http-errors with a 4xx `status` and `expose: true` — messages written to
    // be shown, like "request entity too large".
    if (typeof error === "object" && error !== null) {
        const { status, expose, message } = error;
        if (expose === true &&
            typeof status === "number" &&
            status >= 400 &&
            status < 500) {
            return {
                statusCode: status,
                message: typeof message === "string" ? message : GENERIC_MESSAGE,
                errorDetails: null,
            };
        }
    }
    return { statusCode: 500, message: GENERIC_MESSAGE, errorDetails: null };
};
const globalErrorHandler = (error, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
next) => {
    const response = toErrorResponse(error);
    // The client no longer sees internals, so every server-side failure must
    // be visible here — including a CustomError 5xx (e.g. a 502 from the
    // refund gateway), whose message is safe to send but still worth logging.
    if (response.statusCode >= 500) {
        // eslint-disable-next-line no-console
        console.error(`[error] ${req.method} ${req.originalUrl}`, error);
    }
    res.status(response.statusCode).json({
        success: false,
        message: response.message,
        errorDetails: response.errorDetails,
    });
};
exports.globalErrorHandler = globalErrorHandler;
