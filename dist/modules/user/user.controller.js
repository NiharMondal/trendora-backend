"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userControllers = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler.js");
const user_service_1 = require("./user.service");
const sendResponse_1 = require("../../utils/sendResponse.js");
const getAllFromDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { users, meta } = await user_service_1.userServices.getAllFromDB(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Users fetched successfully",
        meta: meta,
        data: users,
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
const findById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await user_service_1.userServices.findById(req.params.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "User fetched successfully",
        data: data,
    });
});
const disableUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await user_service_1.userServices.disableUser({ id: req.user.id, ipAddress: req.ip }, req.params.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Account disabled successfully",
        data: data,
    });
});
const restoreUser = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await user_service_1.userServices.restoreUser(req.params.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Account restored successfully",
        data: data,
    });
});
const updateRole = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await user_service_1.userServices.updateRole(req.user.id, req.params.id, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Role updated successfully",
        data: data,
    });
});
exports.userControllers = {
    getAllFromDB,
    myProfile,
    updateData,
    findById,
    disableUser,
    restoreUser,
    updateRole,
};
