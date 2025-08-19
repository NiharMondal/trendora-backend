"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderControllers = void 0;
const order_service_1 = require("./order.service");
const asyncHandler_1 = require("../../utils/asyncHandler");
const sendResponse_1 = require("../../utils/sendResponse");
const createOrder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await order_service_1.orderServices.createOrder(req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Order placed successfully",
        data: data,
    });
});
exports.orderControllers = { createOrder };
