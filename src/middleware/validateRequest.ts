import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ZodObject } from "zod";

export const validateRequest = (schema: ZodObject) => {
	return asyncHandler(
		async (req: Request, res: Response, next: NextFunction) => {
			const result = await schema.safeParseAsync(req.body);
			if (!result.success) {
				next(result.error);
			} else {
				req.body = result.data;
				next();
			}
		}
	);
};
