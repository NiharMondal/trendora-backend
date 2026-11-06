import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { userServices } from "./user.service";
import { sendResponse } from "@/utils/sendResponse";

const getAllFromDB = asyncHandler(async (req: Request, res: Response) => {
	const { users, meta } = await userServices.getAllFromDB(req.query);

	sendResponse(res, {
		statusCode: 200,
		message: "Users fetched successfully",
		meta: meta,
		data: users,
	});
});
const myProfile = asyncHandler(async (req: Request, res: Response) => {
	const data = await userServices.myProfile(req.user.id);

	sendResponse(res, {
		statusCode: 200,
		message: "Users fetched successfully",
		data: data,
	});
});
const updateData = asyncHandler(async (req: Request, res: Response) => {
	const data = await userServices.updateData(req.body, req.user.id);

	sendResponse(res, {
		statusCode: 200,
		message: "Information updated successfully",
		data: data,
	});
});
export const userControllers = { getAllFromDB , myProfile, updateData };
