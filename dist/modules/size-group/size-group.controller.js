"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sizeGroupControllers = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler.js");
const sendResponse_1 = require("../../utils/sendResponse.js");
const size_group_service_1 = require("./size-group.service");
const createIntoDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await size_group_service_1.sizeGroupServices.createIntoDB(req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Size group created successfully",
        data: data,
    });
});
const findAllFromDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { meta, sizeGroups } = await size_group_service_1.sizeGroupServices.findAllFromDB(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Size group fetched successfully",
        meta: meta,
        data: sizeGroups,
    });
});
const findById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await size_group_service_1.sizeGroupServices.findById(id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Size group fetched successfully",
        data: data,
    });
});
const updateData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await size_group_service_1.sizeGroupServices.updateData(id, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Size group updated successfully",
        data: data,
    });
});
const deleteData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await size_group_service_1.sizeGroupServices.deleteData(id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Size group deleted successfully",
        data: data,
    });
});
exports.sizeGroupControllers = {
    createIntoDB,
    findAllFromDB,
    findById,
    updateData,
    deleteData,
};
