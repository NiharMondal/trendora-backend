"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderControllers = void 0;
const order_service_1 = require("./order.service");
const date_range_1 = require("../../helpers/date-range.js");
const asyncHandler_1 = require("../../utils/asyncHandler.js");
const sendResponse_1 = require("../../utils/sendResponse.js");
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
/** Headline numbers for the shopper dashboard — the caller's own purchases. */
const getMySummary = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await order_service_1.orderServices.getMySummary(req.user.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Order summary fetched successfully",
        data,
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
    const { startDate, endDate } = (0, date_range_1.parseDateRange)(req.query);
    const data = await order_service_1.orderServices.getDashboardAnalytics(startDate, endDate);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Analytics fetched successfully",
        data,
    });
});
exports.orderControllers = {
    getMySummary,
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
