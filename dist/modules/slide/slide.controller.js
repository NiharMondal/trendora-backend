"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slideControllers = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const sendResponse_1 = require("../../utils/sendResponse");
const slide_service_1 = require("./slide.service");
const createIntoDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await slide_service_1.slideServices.createIntoDB(req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Slide created successfully",
        data: data,
    });
});
const findAllFromDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const slide = await slide_service_1.slideServices.findAllFromDB();
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Slide fetched successfully",
        data: slide,
    });
});
const findById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await slide_service_1.slideServices.findById(id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Slide fetched successfully",
        data: data,
    });
});
const updateData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await slide_service_1.slideServices.updateData(id, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Slide updated successfully",
        data: data,
    });
});
const deleteData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await slide_service_1.slideServices.deleteData(id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Slide deleted successfully",
        data: data,
    });
});
exports.slideControllers = {
    createIntoDB,
    findAllFromDB,
    findById,
    updateData,
    deleteData,
};
