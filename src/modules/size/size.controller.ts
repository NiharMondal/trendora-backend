import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { sizeServices } from "./size.service";

const createIntoDB = asyncHandler(async (req: Request, res: Response) => {
	const data = await sizeServices.createIntoDB(req.body);

	sendResponse(res, {
		statusCode: 201,
		message: "Size created successfully",
		data: data,
	});
});

const findAllFromDB = asyncHandler(async (req: Request, res: Response) => {
	const { meta, sizes } = await sizeServices.findAllFromDB(req.query);

	sendResponse(res, {
		statusCode: 200,
		message: "Size fetched successfully",
		meta: meta,
		data: sizes,
	});
});
const findById = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await sizeServices.findById(id);

	sendResponse(res, {
		statusCode: 200,
		message: "Size fetched successfully",
		data: data,
	});
});

const updateData = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await sizeServices.updateData(id, req.body);

	sendResponse(res, {
		statusCode: 200,
		message: "Size updated successfully",
		data: data,
	});
});
const deleteData = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await sizeServices.deleteData(id);

	sendResponse(res, {
		statusCode: 200,
		message: "Size deleted successfully",
		data: data,
	});
});

export const sizeControllers = {
	createIntoDB,
	findAllFromDB,
	findById,
	updateData,
	deleteData,
};
