import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { productImageServices } from "./image.service";
import { sendResponse } from "../../utils/sendResponse";

const findByProductId = asyncHandler(async (req: Request, res: Response) => {
	const productId = req.params.productId;

	const data = await productImageServices.findByProductId(productId);

	sendResponse(res, {
		statusCode: 200,
		message: "Product images fetched successfully",
		data: data,
	});
});

export const productImageController = { findByProductId };
