import { orderServices } from "./order.service";
import { parseDateRange } from "@/helpers/date-range";
import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendResponse } from "@/utils/sendResponse";

const actorOf = (req: Request) => ({
	id: req.user.id as string,
	role: req.user.role as string,
});

const createOrder = asyncHandler(async (req: Request, res: Response) => {
	const userAgent = req.headers["user-agent"] || "Unknown";
	const ipAddress = req.ip || "Unknown";
	const userId = req.user.id;
	const payload = {
		...req.body,
		userAgent,
		ipAddress,
		userId,
	};
	const data = await orderServices.createOrder(payload);
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
	const data = await orderServices.getOrderById(
		req.params.orderId,
		actorOf(req),
	);

	sendResponse(res, {
		statusCode: 200,
		message: "Order fetched successfully",
		data: data,
	});
});
/** Headline numbers for the shopper dashboard — the caller's own purchases. */
const getMySummary = asyncHandler(async (req: Request, res: Response) => {
	const data = await orderServices.getMySummary(req.user.id);

	sendResponse(res, {
		statusCode: 200,
		message: "Order summary fetched successfully",
		data,
	});
});

const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
	// NOTE: this used to read `req.user.userId`, which is not in the JWT
	// payload ({ id, role, email }) — it was always undefined, so the filter
	// silently matched nothing.
	const userId = req.user.id;
	const { orders, meta } = await orderServices.getMyOrders(userId, req.query);

	sendResponse(res, {
		statusCode: 200,
		message: "My Order fetched successfully",
		meta: meta,
		data: orders,
	});
});

const getMyVendorOrders = asyncHandler(async (req: Request, res: Response) => {
	const { vendorOrders, meta } = await orderServices.getMyVendorOrders(
		actorOf(req),
		req.query,
	);

	sendResponse(res, {
		statusCode: 200,
		message: "Vendor orders fetched successfully",
		meta,
		data: vendorOrders,
	});
});

const getVendorOrderById = asyncHandler(async (req: Request, res: Response) => {
	const data = await orderServices.getVendorOrderById(
		actorOf(req),
		req.params.vendorOrderId,
	);

	sendResponse(res, {
		statusCode: 200,
		message: "Vendor order fetched successfully",
		data,
	});
});

const updateVendorOrderStatus = asyncHandler(
	async (req: Request, res: Response) => {
		const data = await orderServices.updateVendorOrderStatus(
			actorOf(req),
			req.params.vendorOrderId,
			req.body,
			req.ip,
		);

		sendResponse(res, {
			statusCode: 200,
			message: "Order status updated successfully",
			data,
		});
	},
);

const getDashboardAnalytics = asyncHandler(
	async (req: Request, res: Response) => {
		const { startDate, endDate } = parseDateRange(req.query);

		const data = await orderServices.getDashboardAnalytics(
			startDate,
			endDate,
		);

		sendResponse(res, {
			statusCode: 200,
			message: "Analytics fetched successfully",
			data,
		});
	},
);

export const orderControllers = {
	getMySummary,
	createOrder,
	findAllFromDB,
	getOrderById,
	getMyOrders,
	//
	getMyVendorOrders,
	getVendorOrderById,
	updateVendorOrderStatus,
	//
	getDashboardAnalytics,
};
