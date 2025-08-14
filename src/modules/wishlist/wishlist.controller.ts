import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { wishlistServices } from "./wishlist.service";

const createIntoDB = asyncHandler(async (req: Request, res: Response) => {
	const data = await wishlistServices.createIntoDB(req.body);

	sendResponse(res, {
		statusCode: 201,
		message: "Wishlist added successfully",
		data: data,
	});
});

const findByUserId = asyncHandler(async (req: Request, res: Response) => {
	const id = req.user.id;
	const data = await wishlistServices.findByUserId(id);

	sendResponse(res, {
		statusCode: 200,
		message: "Wishlist fetched successfully",
		data: data,
	});
});
const findById = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await wishlistServices.findById(id);

	sendResponse(res, {
		statusCode: 200,
		message: "Wishlist fetched successfully",
		data: data,
	});
});

const deleteData = asyncHandler(async (req: Request, res: Response) => {
	const id = req.params.id;
	const data = await wishlistServices.deleteData(id);

	sendResponse(res, {
		statusCode: 200,
		message: "Wishlist deleted successfully",
		data: data,
	});
});

export const wishlistControllers = {
	createIntoDB,
	findByUserId,
	findById,

	deleteData,
};
