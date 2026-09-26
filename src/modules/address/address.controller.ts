import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";

import { addressServices } from "./address.service";

const createIntoDB = asyncHandler(async (req: Request, res: Response) => {
	const user = req.user;
	const data = await addressServices.createIntoDB(req.body, user.id);

	sendResponse(res, {
		statusCode: 201,
		message: "Address created successfully",
		data: data,
	});
});
const findAllFromDB = asyncHandler(async (req: Request, res: Response) => {
	const data = await addressServices.findAllFromDB();

	sendResponse(res, {
		statusCode: 200,
		message: "Address fetched successfully",
		data: data,
	});
});

const findMyAddress = asyncHandler(
	async (req: Request, res: Response) => {
		const userId = req.user.id;
		const data = await addressServices.findMyAddress(userId);

		sendResponse(res, {
			statusCode: 200,
			message: "Address fetched successfully",
			data: data,
		});
	}
);
// The three single-address handlers all pass `req.user.id` to the service,
// which scopes the lookup to the caller. Dropping that argument silently
// reopens the IDOR these routes used to have — see docs/FEATURE-GAPS.md BE-02.
const findById = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await addressServices.findById(id, req.user.id);

	sendResponse(res, {
		statusCode: 200,
		message: "Address fetched successfully",
		data: data,
	});
});

const updateData = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await addressServices.updateData(id, req.user.id, req.body);

	sendResponse(res, {
		statusCode: 200,
		message: "Address updated successfully",
		data: data,
	});
});
const deleteData = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await addressServices.deleteData(id, req.user.id);

	sendResponse(res, {
		statusCode: 200,
		message: "Address deleted successfully",
		data: data,
	});
});

export const addressControllers = {
	createIntoDB,
	findAllFromDB,
	findMyAddress,
	findById,
	updateData,
	deleteData,
};
