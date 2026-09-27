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
exports.paymentControllers = {
    createPaymentWithStripeWebhook,
};
