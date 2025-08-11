import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { userServices } from "./user.service";
import { sendResponse } from "../../utils/sendResponse";

const getAllFromDB = asyncHandler(async (req: Request, res: Response) => {
	const data = await userServices.getAllFromDB();

	sendResponse(res, {
		statusCode: 200,
		message: "Users fetched successfully",
		data: data,
	});
});

export const userControllers = { getAllFromDB };
