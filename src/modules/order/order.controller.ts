import { orderServices } from "./order.service";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";

const createOrder = asyncHandler(async (req: Request, res: Response) => {
	const data = await orderServices.createOrder(req.body);

	sendResponse(res, {
		statusCode: 201,
		message: "Order placed successfully",
		data: data,
	});
});

export const orderControllers = { createOrder };
