import jwt, { JwtPayload } from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import CustomError from "../utils/customError";
import { envConfig } from "../config/env-config";
import { prisma } from "../config/db";

export const authGuard = (...roles: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const token = req.headers.authorization;

        try {
            if (!token) {
                throw new CustomError(401, "Access token missing");
            }

            const decodeToken = jwt.verify(
                token,
                envConfig.access_token_secret as string
            ) as JwtPayload;

            const { id, role, exp } = decodeToken;

            // Correct expiration check (exp is in seconds)
            if (exp && exp < Math.floor(Date.now() / 1000)) {
                throw new CustomError(401, "Access token expired");
            }

            const user = await prisma.user.findUniqueOrThrow({
                where: {
                    id: id,
                },
            });

            if (!user || user.isDeleted) {
                throw new CustomError(401, "User not found or deleted");
            }

            // Check for required role (authorization)
            if (roles.length && !roles.includes(role)) {
                throw new CustomError(
                    403,
                    "Forbidden: insufficient permissions"
                );
            }

            // Attach user info to request object
            req.user = decodeToken;

            next();
        } catch (error) {
            // Optional: Handle token expiration separately if you want
            if (
                error instanceof Error &&
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (error as any).name === "TokenExpiredError"
            ) {
                next(new CustomError(401, "Access token expired"));
            } else {
                next(error);
            }
        }
    };
};
