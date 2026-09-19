"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderControllers = void 0;
const order_service_1 = require("./order.service");
const asyncHandler_1 = require("../../utils/asyncHandler");
const sendResponse_1 = require("../../utils/sendResponse");
const actorOf = (req) => ({
    id: req.user.id,
    role: req.user.role,
});
const createOrder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userAgent = req.headers["user-agent"] || "Unknown";
    const ipAddress = req.ip || "Unknown";
    const userId = req.user.id;
    const payload = {
        ...req.body,
        userAgent,
        ipAddress,
        userId,
    };
    const data = await order_service_1.orderServices.createOrder(payload);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Order placed successfully",
        data: data,
    });
});
const findAllFromDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await order_service_1.orderServices.findAllFromDB(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Order fetched successfully",
        meta: data.meta,
        data: data.orders,
    });
});
const getOrderById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await order_service_1.orderServices.getOrderById(req.params.orderId, actorOf(req));
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Order fetched successfully",
        data: data,
    });
});
const getMyOrders = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    // NOTE: this used to read `req.user.userId`, which is not in the JWT
    // payload ({ id, role, email }) — it was always undefined, so the filter
    // silently matched nothing.
    const userId = req.user.id;
    const { orders, meta } = await order_service_1.orderServices.getMyOrders(userId, req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "My Order fetched successfully",
        meta: meta,
        data: orders,
    });
});
const getMyVendorOrders = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { vendorOrders, meta } = await order_service_1.orderServices.getMyVendorOrders(actorOf(req), req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Vendor orders fetched successfully",
        meta,
        data: vendorOrders,
    });
});
const getVendorOrderById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await order_service_1.orderServices.getVendorOrderById(actorOf(req), req.params.vendorOrderId);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Vendor order fetched successfully",
        data,
    });
});
const updateVendorOrderStatus = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await order_service_1.orderServices.updateVendorOrderStatus(actorOf(req), req.params.vendorOrderId, req.body, req.ip);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Order status updated successfully",
        data,
    });
});
const getDashboardAnalytics = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { startDate, endDate } = req.query;
    const data = await order_service_1.orderServices.getDashboardAnalytics(startDate ? new Date(String(startDate)) : undefined, endDate ? new Date(String(endDate)) : undefined);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Analytics fetched successfully",
        data,
    });
});
exports.orderControllers = {
    createOrder,
    findAllFromDB,
    getOrderById,
    getMyOrders,
    //
    getMyVendorOrders,
    getVendorOrderById,
    updateVendorOrderStatus,
    //
    getDashboardAnalytics,
};
