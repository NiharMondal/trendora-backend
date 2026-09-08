"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productImageController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const image_service_1 = require("./image.service");
const sendResponse_1 = require("../../utils/sendResponse");
const findByProductId = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const productId = req.params.productId;
    const data = await image_service_1.productImageServices.findByProductId(productId);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product images fetched successfully",
        data: data,
    });
});
exports.productImageController = { findByProductId };
