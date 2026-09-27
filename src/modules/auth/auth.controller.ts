import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";

import { sendResponse } from "@/utils/sendResponse";
import { authServices } from "./auth.service";

const registerUser = asyncHandler(async (req: Request, res: Response) => {
	const data = await authServices.registerUser(req.body);

	sendResponse(res, {
		statusCode: 201,
		message: "Successfully registered your account",
		data: data,
	});
});
const loginUser = asyncHandler(async (req: Request, res: Response) => {
	const data = await authServices.loginUser(req.body);

	sendResponse(res, {
		statusCode: 200,
		message: "Logged in Successfully",
		data: data,
	});
});

const oAuthLogin = asyncHandler(async (req: Request, res: Response) => {
	const data = await authServices.oAuthLogin(req.body);

	sendResponse(res, {
		statusCode: 200,
		message: "OAuth Logged in Successfully",
		data: data,
	});
});

const changePassword = asyncHandler(async (req: Request, res: Response) => {
	const user = req.user;
	const data = await authServices.changePassword(req.body,  user?.id);

	sendResponse(res, {
		statusCode: 200,
		message: "Password changed Successfully",
		data: data,
	});
});

const refreshToken = asyncHandler(async (req: Request, res: Response) => {
	const token = req.body?.refreshToken;
	const data = await authServices.refreshToken(token);
	sendResponse(res, {
		statusCode: 200,
		message: "Refresh token generated Successfully",
		data: data,
	});
});

/**
 * Always 200 with the same message, and never a payload — the service is
 * deliberately silent about whether the address is registered, so the response
 * must be too. Do not start returning the token here.
 */
const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
	await authServices.forgotPassword(req.body);
	sendResponse(res, {
		statusCode: 200,
		message:
			"If an account exists for that email, a password reset link has been sent.",
		data: null,
	});
});

const resetPassword = asyncHandler(async (req: Request, res: Response) => {
	await authServices.resetPassword(req.body);
	sendResponse(res, {
		statusCode: 200,
		message: "Password has been reset successfully. You can now log in.",
		data: null,
	});
});

export const authControllers = {
	registerUser,
	loginUser,
	oAuthLogin,
	changePassword,
	refreshToken,
	forgotPassword,
	resetPassword,
};
