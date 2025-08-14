import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";

import { addressServices } from "./address.service";

const createIntoDB = asyncHandler(async (req: Request, res: Response) => {
	const data = await addressServices.createIntoDB(req.body);

	sendResponse(res, {
		statusCode: 201,
		message: "Address created successfully",
		data: data,
	});
});

const findAddressByUserId = asyncHandler(
	async (req: Request, res: Response) => {
		const data = await addressServices.findAddressByUserId(req.query);

		sendResponse(res, {
			statusCode: 200,
			message: "Address fetched successfully",
			data: data,
		});
	}
);
const findById = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await addressServices.findById(id);

	sendResponse(res, {
		statusCode: 200,
		message: "Address fetched successfully",
		data: data,
	});
});

const updateData = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await addressServices.updateData(id, req.body);

	sendResponse(res, {
		statusCode: 200,
		message: "Address updated successfully",
		data: data,
	});
});
const deleteData = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await addressServices.deleteData(id);

	sendResponse(res, {
		statusCode: 200,
		message: "Address deleted successfully",
		data: data,
	});
});

export const addressControllers = {
	createIntoDB,
	findAddressByUserId,
	findById,
	updateData,
	deleteData,
};
