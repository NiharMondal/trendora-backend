import { Request, Response } from "express";

export const notFoundRoute = (req: Request, res: Response) => {
	res.status(404).json({
		success: false,
		status: 404,
		message: "Route is not found for " + req.originalUrl,
	});
};
