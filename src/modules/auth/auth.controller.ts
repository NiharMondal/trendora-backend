import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";

import { sendResponse } from "../../utils/sendResponse";
import { authServices } from "./auth.service";

const registerUser = asyncHandler(async (req: Request, res: Response) => {
	const data = await authServices.registerUser(req.body);

	sendResponse(res, {
		statusCode: 201,
		message: "Successfully registered your account",
		data: data,
	});
});

export const authControllers = { registerUser };
