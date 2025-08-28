import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { paymentServices } from "./payment.service";

const createPaymentWithStripeWebhook = asyncHandler(
	async (req: Request, res: Response) => {
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

export const paymentControllers = {
	createPaymentWithStripeWebhook,
};
