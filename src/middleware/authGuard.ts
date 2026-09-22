import jwt, { JwtPayload } from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import CustomError from "@/utils/customError";
import { envConfig } from "@/config/env-config";
import { prisma } from "@/config/db";

/**
 * Verifies the access token and enforces role membership.
 *
 * **The role is read from the database, never from the token.** The JWT does
 * carry a `role` claim, but it is a 20-minute-old snapshot and this middleware
 * already loads the `Auth` row anyway — trusting the claim would mean doing the
 * query and then ignoring the authoritative answer it returned.
 *
 * That matters in both directions:
 * - A demoted admin would keep admin for the rest of the token's life. Not just
 *   for routing: `req.user.role` flows into `resolveVendorScope` and
 *   `vendorListScope` (`src/helpers/vendor.ts`), where ADMIN means "may act on
 *   any store". A stale claim is a write-scope escalation, not a cosmetic one.
 * - A newly approved seller would be locked out of their own dashboard until
 *   their token refreshed, because approval flips `Auth.role` to VENDOR
 *   (`vendor.service.ts`) and nothing told the old token.
 *
 * `req.user` is therefore the decoded payload **with `role` overwritten by the
 * database value**, so every downstream authorization decision sees the same
 * role this guard enforced.
 */
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
            const { id, exp } = decodeToken;

            // Correct expiration check (exp is in seconds)
            if (exp && exp < Math.floor(Date.now() / 1000)) {
                throw new CustomError(401, "Access token expired");
            }

            // `findUnique`, not `findUniqueOrThrow`: a token naming a deleted
            // user is an authentication failure (401), and letting Prisma raise
            // P2025 would surface it as a 400 through the global handler.
            const user = await prisma.user.findUnique({
                where: {
                    id: id,
                },
                include: {
                    auth: true,
                },
            });

            if (!user || user.isDeleted) {
                throw new CustomError(401, "User not found or deleted");
            }

            // `User.auth` is optional in the schema. No credentials row means
            // the account cannot be authenticated, whatever the token says.
            if (!user.auth) {
                throw new CustomError(401, "User not found or deleted");
            }

            const currentRole = user.auth.role;

            // Check for required role (authorization) — against the DB, not the
            // token. See the note above before changing this back.
            if (roles.length && !roles.includes(currentRole)) {
                throw new CustomError(
                    403,
                    "Forbidden: insufficient permissions"
                );
            }

            // Attach user info to request object, with the live role.
            req.user = { ...decodeToken, role: currentRole };

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
