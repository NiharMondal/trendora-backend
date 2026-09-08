"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payoutControllers = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const sendResponse_1 = require("../../utils/sendResponse");
const payout_service_1 = require("./payout.service");
const actorOf = (req) => ({
    id: req.user.id,
    role: req.user.role,
});
const getMyBalance = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await payout_service_1.payoutServices.getMyBalance(actorOf(req), req.query.vendorId ? String(req.query.vendorId) : undefined);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Balance fetched successfully",
        data,
    });
});
const getMyPayouts = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { data, meta } = await payout_service_1.payoutServices.getMyPayouts(actorOf(req), req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Payouts fetched successfully",
        data,
        meta,
    });
});
const findById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await payout_service_1.payoutServices.findById(actorOf(req), req.params.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Payout fetched successfully",
        data,
    });
});
const generatePayout = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await payout_service_1.payoutServices.generatePayout(req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Payout generated successfully",
        data,
    });
});
const markPaid = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await payout_service_1.payoutServices.markPaid(req.params.id, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Payout marked as paid",
        data,
    });
});
const markFailed = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await payout_service_1.payoutServices.markFailed(req.params.id, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Payout marked as failed and earnings released",
        data,
    });
});
const findAllForAdmin = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { data, meta } = await payout_service_1.payoutServices.findAllForAdmin(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Payouts fetched successfully",
        data,
        meta,
    });
});
const getOutstandingBalances = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const data = await payout_service_1.payoutServices.getOutstandingBalances();
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Outstanding balances fetched successfully",
        data,
    });
});
exports.payoutControllers = {
    getMyBalance,
    getMyPayouts,
    findById,
    //
    generatePayout,
    markPaid,
    markFailed,
    findAllForAdmin,
    getOutstandingBalances,
};
