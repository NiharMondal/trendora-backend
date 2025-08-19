"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.variantController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const sendResponse_1 = require("../../utils/sendResponse");
const variant_service_1 = require("./variant.service");
const addVariants = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const productId = req.params.productId;
    const data = await variant_service_1.variantServices.addVariants(productId, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Product variants created successfully",
        data: data,
    });
});
const findByProductId = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const productId = req.params.productId;
    const data = await variant_service_1.variantServices.findByProductId(productId);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product variants fetched successfully",
        data: data,
    });
});
exports.variantController = { addVariants, findByProductId };
