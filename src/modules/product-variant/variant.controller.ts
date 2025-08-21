import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { variantServices } from "./variant.service";

const findByProductId = asyncHandler(async (req: Request, res: Response) => {
	const productId = req.params.productId;

	const data = await variantServices.findByProductId(productId);

	sendResponse(res, {
		statusCode: 200,
		message: "Product variants fetched successfully",
		data: data,
	});
});

export const variantController = { findByProductId };
