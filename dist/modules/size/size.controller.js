"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sizeControllers = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const sendResponse_1 = require("../../utils/sendResponse");
const size_service_1 = require("./size.service");
const createIntoDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await size_service_1.sizeServices.createIntoDB(req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Size created successfully",
        data: data,
    });
});
const findAllFromDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { meta, sizes } = await size_service_1.sizeServices.findAllFromDB(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Size fetched successfully",
        meta: meta,
        data: sizes,
    });
});
const findById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await size_service_1.sizeServices.findById(id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Size fetched successfully",
        data: data,
    });
});
const updateData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await size_service_1.sizeServices.updateData(id, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Size updated successfully",
        data: data,
    });
});
const deleteData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await size_service_1.sizeServices.deleteData(id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Size deleted successfully",
        data: data,
    });
});
exports.sizeControllers = {
    createIntoDB,
    findAllFromDB,
    findById,
    updateData,
    deleteData,
};
