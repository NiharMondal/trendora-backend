"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authGuard = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const customError_1 = __importDefault(require("../utils/customError"));
const env_config_1 = require("../config/env-config");
const db_1 = require("../config/db");
const authGuard = (...roles) => {
    return async (req, res, next) => {
        const token = req.headers.authorization;
        try {
            if (!token) {
                throw new customError_1.default(401, "Access token missing");
            }
            const decodeToken = jsonwebtoken_1.default.verify(token, env_config_1.envConfig.access_token_secret);
            const { id, role, exp } = decodeToken;
            // Correct expiration check (exp is in seconds)
            if (exp && exp < Math.floor(Date.now() / 1000)) {
                throw new customError_1.default(401, "Access token expired");
            }
            const user = await db_1.prisma.user.findUniqueOrThrow({
                where: {
                    id: id,
                },
            });
            if (!user || user.isDeleted) {
                throw new customError_1.default(401, "User not found or deleted");
            }
            // Check for required role (authorization)
            if (roles.length && !roles.includes(role)) {
                throw new customError_1.default(403, "Forbidden: insufficient permissions");
            }
            // Attach user info to request object
            req.user = decodeToken;
            next();
        }
        catch (error) {
            // Optional: Handle token expiration separately if you want
            if (error instanceof Error &&
                error.name === "TokenExpiredError") {
                next(new customError_1.default(401, "Access token expired"));
            }
            else {
                next(error);
            }
        }
    };
};
exports.authGuard = authGuard;
