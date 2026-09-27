"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userControllers = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler.js");
const user_service_1 = require("./user.service");
const sendResponse_1 = require("../../utils/sendResponse.js");
const getAllFromDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await user_service_1.userServices.getAllFromDB();
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Users fetched successfully",
        data: data,
    });
});
const myProfile = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await user_service_1.userServices.myProfile(req.user.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Users fetched successfully",
        data: data,
    });
});
const updateData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await user_service_1.userServices.updateData(req.body, req.user.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Information updated successfully",
        data: data,
    });
});
exports.userControllers = { getAllFromDB, myProfile, updateData };
