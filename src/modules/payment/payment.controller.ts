import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { paymentServices } from "./payment.service";

const createPaymentWithStripeWebhook = asyncHandler(
	async (req: Request, res: Response) => {
		console.log(req.body);
		const sig = req.headers["stripe-signature"];
		const data = await paymentServices.createPaymentWithStripeWebhook(
			req.body,
			sig
		);

		sendResponse(res, {
			statusCode: 201,
			message: "Payment created successfully with STRIPE",
			data: data,
		});
	}
);
const createPaymentWithSSL = asyncHandler(
	async (req: Request, res: Response) => {
		const query = req.query;
		const data = await paymentServices.createPaymentWithSSL(query);

		sendResponse(res, {
			statusCode: 201,
			message: "Payment created successfully with SSL_COMMERZ",
			data: data,
		});
	}
);

export const paymentControllers = {
	createPaymentWithStripeWebhook,
	createPaymentWithSSL,
};
