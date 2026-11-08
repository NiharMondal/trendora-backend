import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendResponse } from "@/utils/sendResponse";
import { paymentServices } from "./payment.service";

const createPaymentWithStripeWebhook = asyncHandler(
	async (req: Request, res: Response) => {
		const sig = req.headers["stripe-signature"];
		const data = await paymentServices.handleStripeWebhook(
			req.body,
			sig as string
		);

		sendResponse(res, {
			statusCode: 201,
			message: "Payment created successfully with STRIPE",
			data: data,
		});
	}
);

/** The authenticated caller, in the shape the read services expect. */
const actorOf = (req: Request) => ({
	id: req.user.id as string,
	role: req.user.role as string,
});

const findMine = asyncHandler(async (req: Request, res: Response) => {
	const { data, meta } = await paymentServices.findMine(
		actorOf(req),
		req.query,
	);

	sendResponse(res, {
		statusCode: 200,
		message: "Payments fetched successfully",
		meta: meta,
		data: data,
	});
});

const findByOrderId = asyncHandler(async (req: Request, res: Response) => {
	const data = await paymentServices.findByOrderId(
		actorOf(req),
		req.params.orderId,
	);

	sendResponse(res, {
		statusCode: 200,
		message: "Payment fetched successfully",
		data: data,
	});
});

const findAllForAdmin = asyncHandler(async (req: Request, res: Response) => {
	const { data, meta } = await paymentServices.findAllForAdmin(req.query);

	sendResponse(res, {
		statusCode: 200,
		message: "Payments fetched successfully",
		meta: meta,
		data: data,
	});
});

const findById = asyncHandler(async (req: Request, res: Response) => {
	const data = await paymentServices.findById(req.params.id);

	sendResponse(res, {
		statusCode: 200,
		message: "Payment fetched successfully",
		data: data,
	});
});

export const paymentControllers = {
	createPaymentWithStripeWebhook,
	findMine,
	findByOrderId,
	findAllForAdmin,
	findById,
};
