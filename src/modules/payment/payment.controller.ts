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
			statusCode: 200,
			message: "Payment created successfully",
			data: data,
		});
	}
);

export const paymentControllers = { createPaymentWithStripeWebhook };
