import { NextFunction, Request, Response } from "express";
import { Prisma } from "../../generated/prisma";

export const globalErrorHandler = (
	error: any,
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const errorResponse = {
		statusCode: error?.statusCode || 500,
		message: error?.message || "Something went wrong",
		errorDetails: error,
	};

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
	}

	res.status(errorResponse.statusCode).json({
		success: false,
		message: errorResponse.message,
		errorDetails: errorResponse.errorDetails,
	});
};
