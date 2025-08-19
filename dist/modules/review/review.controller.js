"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewControllers = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const sendResponse_1 = require("../../utils/sendResponse");
const review_service_1 = require("./review.service");
const createIntoDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await review_service_1.reviewServices.createIntoDB(req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Review added successfully",
        data: data,
    });
});
const findAllFromDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await review_service_1.reviewServices.findAllFromDB(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Review fetched successfully",
        data: data,
    });
});
const findByUserId = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.user.id;
    const data = await review_service_1.reviewServices.findByUserId(id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Review fetched successfully",
        data: data,
    });
});
const findById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await review_service_1.reviewServices.findById(id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Review fetched successfully",
        data: data,
    });
});
const updateData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await review_service_1.reviewServices.updateData(id, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Review updated successfully",
        data: data,
    });
});
const deleteData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await review_service_1.reviewServices.deleteData(id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Review deleted successfully",
        data: data,
    });
});
exports.reviewControllers = {
    createIntoDB,
    findByUserId,
    findById,
    updateData,
    findAllFromDB,
    deleteData,
};
