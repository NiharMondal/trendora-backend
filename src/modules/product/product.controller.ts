import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { productServices } from "./product.service";

const createIntoDB = asyncHandler(async (req: Request, res: Response) => {
	const data = await productServices.createIntoDB(req.body);

	sendResponse(res, {
		statusCode: 201,
		message: "Product created successfully",
		data: data,
	});
});

const findAllFromDB = asyncHandler(async (req: Request, res: Response) => {
	const data = await productServices.findAllFromDB(req.query);

	sendResponse(res, {
		statusCode: 200,
		message: "Product fetched successfully",
		data: data,
	});
});
const findById = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await productServices.findById(id);

	sendResponse(res, {
		statusCode: 200,
		message: "Product fetched successfully",
		data: data,
	});
});
const findBySlug = asyncHandler(async (req: Request, res: Response) => {
	const slug = req.params.slug;
	const data = await productServices.findBySlug(slug);

	sendResponse(res, {
		statusCode: 200,
		message: "Product fetched successfully",
		data: data,
	});
});

const updateData = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await productServices.updateData(id, req.body);

	sendResponse(res, {
		statusCode: 200,
		message: "Product updated successfully",
		data: data,
	});
});
const deleteData = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await productServices.deleteData(id);

	sendResponse(res, {
		statusCode: 200,
		message: "Product deleted successfully",
		data: data,
	});
});

export const productControllers = {
	createIntoDB,
	findAllFromDB,
	findById,
	findBySlug,
	updateData,
	deleteData,
};
