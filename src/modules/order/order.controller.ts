import { orderServices } from "./order.service";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";

const createOrder = asyncHandler(async (req: Request, res: Response) => {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.ip || 'Unknown';
	const data = await orderServices.createOrder({...req.body, userAgent, ipAddress});

	sendResponse(res, {
		statusCode: 201,
		message: "Order placed successfully",
		data: data,
	});
});
const findAllFromDB = asyncHandler(async (req: Request, res: Response) => {
	const data = await orderServices.findAllFromDB(req.query);

	sendResponse(res, {
		statusCode: 200,
		message: "Order fetched successfully",
		meta: data.meta,
		data: data.orders,
	});
});
const getOrderById = asyncHandler(async (req: Request, res: Response) => {
	const data = await orderServices.getOrderById(req.params.orderId);

	sendResponse(res, {
		statusCode: 200,
		message: "Order fetched successfully",
		data: data,
	});
});
const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
	const userId = req.user.userId;
	const data = await orderServices.getMyOrders(userId);

	sendResponse(res, {
		statusCode: 200,
		message: "My Order fetched successfully",

		data: data,
	});
});

const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
	const orderId = req.params.orderId;
	const data = await orderServices.updateOrderStatus(orderId, req.body);

	sendResponse(res, {
		statusCode: 200,
		message: "Order status updated successfully",
		data: data,
	});
});

export const orderControllers = {
	createOrder,
	findAllFromDB,
	getOrderById,
	updateOrderStatus,
	getMyOrders,
};
