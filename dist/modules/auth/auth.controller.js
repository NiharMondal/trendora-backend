"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authControllers = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const sendResponse_1 = require("../../utils/sendResponse");
const auth_service_1 = require("./auth.service");
const registerUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await auth_service_1.authServices.registerUser(req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Successfully registered your account",
        data: data,
    });
});
const loginUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await auth_service_1.authServices.loginUser(req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Logged in Successfully",
        data: data,
    });
});
const oAuthLogin = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await auth_service_1.authServices.oAuthLogin(req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "OAuth Logged in Successfully",
        data: data,
    });
});
const changePassword = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const data = await auth_service_1.authServices.changePassword(req.body, user?.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Password changed Successfully",
        data: data,
    });
});
const refreshToken = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const token = req.body?.refreshToken;
    const data = await auth_service_1.authServices.refreshToken(token);
    (0, sendResponse_1.sendResponse)(res, {
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
const forgotPassword = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await auth_service_1.authServices.forgotPassword(req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "If an account exists for that email, a password reset link has been sent.",
        data: null,
    });
});
const resetPassword = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await auth_service_1.authServices.resetPassword(req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Password has been reset successfully. You can now log in.",
        data: null,
    });
});
exports.authControllers = {
    registerUser,
    loginUser,
    oAuthLogin,
    changePassword,
    refreshToken,
    forgotPassword,
    resetPassword,
};
