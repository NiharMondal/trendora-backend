"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addressControllers = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const sendResponse_1 = require("../../utils/sendResponse");
const address_service_1 = require("./address.service");
const createIntoDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await address_service_1.addressServices.createIntoDB(req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Address created successfully",
        data: data,
    });
});
const findAddressByUserId = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const data = await address_service_1.addressServices.findAddressByUserId(userId);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Address fetched successfully",
        data: data,
    });
});
const findById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await address_service_1.addressServices.findById(id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Address fetched successfully",
        data: data,
    });
});
const updateData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await address_service_1.addressServices.updateData(id, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Address updated successfully",
        data: data,
    });
});
const deleteData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await address_service_1.addressServices.deleteData(id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Address deleted successfully",
        data: data,
    });
});
exports.addressControllers = {
    createIntoDB,
    findAddressByUserId,
    findById,
    updateData,
    deleteData,
};
