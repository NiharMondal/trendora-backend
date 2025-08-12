import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { categoryServices } from "./category.service";

const createIntoDB = asyncHandler(async (req: Request, res: Response) => {
	const data = await categoryServices.createIntoDB(req.body);

	sendResponse(res, {
		statusCode: 201,
		message: "Category created successfully",
		data: data,
	});
});

const findAllFromDB = asyncHandler(async (req: Request, res: Response) => {
	const data = await categoryServices.findAllFromDB(req.query);

	sendResponse(res, {
		statusCode: 200,
		message: "Category fetched successfully",
		data: data,
	});
});

export const categoryControllers = { createIntoDB, findAllFromDB };
