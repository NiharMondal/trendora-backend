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
	const { category, meta } = await categoryServices.findAllFromDB(req.query);

	sendResponse(res, {
		statusCode: 200,
		message: "Category fetched successfully",
		meta: meta,
		data: category,
	});
});
const findById = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await categoryServices.findById(id);

	sendResponse(res, {
		statusCode: 200,
		message: "Category fetched successfully",
		data: data,
	});
});

const updateData = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await categoryServices.updateData(id, req.body);

	sendResponse(res, {
		statusCode: 200,
		message: "Category updated successfully",
		data: data,
	});
});
const deleteData = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await categoryServices.deleteData(id);

	sendResponse(res, {
		statusCode: 200,
		message: "Category deleted successfully",
		data: data,
	});
});

export const categoryControllers = {
	createIntoDB,
	findAllFromDB,
	findById,
	updateData,
	deleteData,
};
