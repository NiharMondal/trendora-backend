"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productControllers = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const sendResponse_1 = require("../../utils/sendResponse");
const product_service_1 = require("./product.service");
const createIntoDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await product_service_1.productServices.createIntoDB(req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Product created successfully",
        data: data,
    });
});
const findAllFromDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await product_service_1.productServices.findAllFromDB(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product fetched successfully",
        data: data,
    });
});
const findById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await product_service_1.productServices.findById(id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product fetched successfully",
        data: data,
    });
});
const findBySlug = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const slug = req.params.slug;
    const data = await product_service_1.productServices.findBySlug(slug);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product fetched successfully",
        data: data,
    });
});
const updateData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await product_service_1.productServices.updateData(id, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product updated successfully",
        data: data,
    });
});
const deleteData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await product_service_1.productServices.deleteData(id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product deleted successfully",
        data: data,
    });
});
exports.productControllers = {
    createIntoDB,
    findAllFromDB,
    findById,
    findBySlug,
    updateData,
    deleteData,
};
