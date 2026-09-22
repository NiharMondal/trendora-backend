import { Request, Response } from "express";

import { asyncHandler } from "@/utils/asyncHandler";
import { sendResponse } from "@/utils/sendResponse";

import { variantServices } from "./variant.service";

/** The authenticated caller, in the shape the vendor scoping helpers expect. */
const actorOf = (req: Request) => ({
	id: req.user.id as string,
	role: req.user.role as string,
});

const findByProductId = asyncHandler(async (req: Request, res: Response) => {
	const productId = req.params.productId;

	const data = await variantServices.findByProductId(productId);

	sendResponse(res, {
		statusCode: 200,
		message: "Product variants fetched successfully",
		data: data,
	});
});

const addVariants = asyncHandler(async (req: Request, res: Response) => {
	const data = await variantServices.addVariants(
		actorOf(req),
		req.params.productId,
		req.body,
	);

	sendResponse(res, {
		statusCode: 201,
		message: "Variants added successfully",
		data: data,
	});
});

const updateVariant = asyncHandler(async (req: Request, res: Response) => {
	const data = await variantServices.updateVariant(
		actorOf(req),
		req.params.productId,
		req.params.variantId,
		req.body,
	);

	sendResponse(res, {
		statusCode: 200,
		message: "Variant updated successfully",
		data: data,
	});
});

const deleteVariant = asyncHandler(async (req: Request, res: Response) => {
	const data = await variantServices.deleteVariant(
		actorOf(req),
		req.params.productId,
		req.params.variantId,
	);

	sendResponse(res, {
		statusCode: 200,
		message: "Variant removed successfully",
		data: data,
	});
});

export const variantController = {
	findByProductId,
	addVariants,
	updateVariant,
	deleteVariant,
};
