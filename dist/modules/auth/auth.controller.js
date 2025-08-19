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
exports.authControllers = { registerUser, loginUser };
