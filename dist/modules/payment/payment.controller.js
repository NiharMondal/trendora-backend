"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentControllers = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler.js");
const sendResponse_1 = require("../../utils/sendResponse.js");
const payment_service_1 = require("./payment.service");
const createPaymentWithStripeWebhook = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const data = await payment_service_1.paymentServices.handleStripeWebhook(req.body, sig);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Payment created successfully with STRIPE",
        data: data,
    });
});
/** The authenticated caller, in the shape the read services expect. */
const actorOf = (req) => ({
    id: req.user.id,
    role: req.user.role,
});
const findMine = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { data, meta } = await payment_service_1.paymentServices.findMine(actorOf(req), req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Payments fetched successfully",
        meta: meta,
        data: data,
    });
});
const findByOrderId = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await payment_service_1.paymentServices.findByOrderId(actorOf(req), req.params.orderId);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Payment fetched successfully",
        data: data,
    });
});
const findAllForAdmin = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { data, meta } = await payment_service_1.paymentServices.findAllForAdmin(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Payments fetched successfully",
        meta: meta,
        data: data,
    });
});
const findById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await payment_service_1.paymentServices.findById(req.params.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Payment fetched successfully",
        data: data,
    });
});
exports.paymentControllers = {
    createPaymentWithStripeWebhook,
    findMine,
    findByOrderId,
    findAllForAdmin,
    findById,
};
