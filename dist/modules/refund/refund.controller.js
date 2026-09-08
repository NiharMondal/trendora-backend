"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refundControllers = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const sendResponse_1 = require("../../utils/sendResponse");
const refund_service_1 = require("./refund.service");
const actorOf = (req) => ({
    id: req.user.id,
    role: req.user.role,
});
const findAllForAdmin = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { data, meta } = await refund_service_1.refundServices.findAllForAdmin(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Refunds fetched successfully",
        data,
        meta,
    });
});
const getOutstanding = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const data = await refund_service_1.refundServices.getOutstanding();
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Outstanding refunds fetched successfully",
        data,
    });
});
const findMine = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { data, meta } = await refund_service_1.refundServices.findMine(actorOf(req), req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Refunds fetched successfully",
        data,
        meta,
    });
});
const findById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await refund_service_1.refundServices.findById(req.params.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Refund fetched successfully",
        data,
    });
});
const retry = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await refund_service_1.refundServices.retry(req.params.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: data.status === "SUCCEEDED"
            ? "Refund issued successfully"
            : `Refund is now ${data.status.toLowerCase()}`,
        data,
    });
});
const retryAll = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const data = await refund_service_1.refundServices.retryAll();
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: `Attempted ${data.attempted} refund(s): ${data.succeeded} succeeded, ${data.failed} failed`,
        data,
    });
});
const manual = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await refund_service_1.refundServices.manual(req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Manual refund recorded",
        data,
    });
});
const cancel = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await refund_service_1.refundServices.cancel(req.params.id, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Refund cancelled",
        data,
    });
});
exports.refundControllers = {
    findAllForAdmin,
    getOutstanding,
    findMine,
    findById,
    retry,
    retryAll,
    manual,
    cancel,
};
