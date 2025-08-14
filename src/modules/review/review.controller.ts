import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { reviewServices } from "./review.service";

const createIntoDB = asyncHandler(async (req: Request, res: Response) => {
	const data = await reviewServices.createIntoDB(req.body);

	sendResponse(res, {
		statusCode: 201,
		message: "Review added successfully",
		data: data,
	});
});

const findAllFromDB = asyncHandler(async (req: Request, res: Response) => {
	const data = await reviewServices.findAllFromDB(req.query);

	sendResponse(res, {
		statusCode: 200,
		message: "Review fetched successfully",
		data: data,
	});
});
const findByUserId = asyncHandler(async (req: Request, res: Response) => {
	const id = req.user.id;
	const data = await reviewServices.findByUserId(id);

	sendResponse(res, {
		statusCode: 200,
		message: "Review fetched successfully",
		data: data,
	});
});

const findById = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await reviewServices.findById(id);

	sendResponse(res, {
		statusCode: 200,
		message: "Review fetched successfully",
		data: data,
	});
});
const updateData = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await reviewServices.updateData(id, req.body);

	sendResponse(res, {
		statusCode: 200,
		message: "Review updated successfully",
		data: data,
	});
});

const deleteData = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await reviewServices.deleteData(id);

	sendResponse(res, {
		statusCode: 200,
		message: "Review deleted successfully",
		data: data,
	});
});

export const reviewControllers = {
	createIntoDB,
	findByUserId,
	findById,
	updateData,
	findAllFromDB,
	deleteData,
};
