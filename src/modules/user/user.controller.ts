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
const findById = asyncHandler(async (req: Request, res: Response) => {
	const data = await userServices.findById(req.params.id);

	sendResponse(res, {
		statusCode: 200,
		message: "User fetched successfully",
		data: data,
	});
});

const disableUser = asyncHandler(async (req: Request, res: Response) => {
	const data = await userServices.disableUser(
		{ id: req.user.id as string, ipAddress: req.ip },
		req.params.id,
	);

	sendResponse(res, {
		statusCode: 200,
		message: "Account disabled successfully",
		data: data,
	});
});

const restoreUser = asyncHandler(async (req: Request, res: Response) => {
	const data = await userServices.restoreUser(req.params.id);

	sendResponse(res, {
		statusCode: 200,
		message: "Account restored successfully",
		data: data,
	});
});

const updateRole = asyncHandler(async (req: Request, res: Response) => {
	const data = await userServices.updateRole(
		req.user.id,
		req.params.id,
		req.body,
	);

	sendResponse(res, {
		statusCode: 200,
		message: "Role updated successfully",
		data: data,
	});
});

export const userControllers = {
	getAllFromDB,
	myProfile,
	updateData,
	findById,
	disableUser,
	restoreUser,
	updateRole,
};
