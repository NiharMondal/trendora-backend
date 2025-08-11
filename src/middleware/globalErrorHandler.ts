import { NextFunction, Request, Response } from "express";

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

	res.status(errorResponse.statusCode).json({
		success: false,
		message: errorResponse.message,
		errorDetails: errorResponse.errorDetails,
	});
};
