"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorReviewControllers = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const sendResponse_1 = require("../../utils/sendResponse");
const vendor_review_service_1 = require("./vendor-review.service");
const createIntoDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await vendor_review_service_1.vendorReviewServices.createIntoDB(req.user.id, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Store review submitted successfully",
        data,
    });
});
const findByVendorSlug = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { data, meta } = await vendor_review_service_1.vendorReviewServices.findByVendorSlug(req.params.slug, req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Store reviews fetched successfully",
        data,
        meta,
    });
});
const findMine = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await vendor_review_service_1.vendorReviewServices.findMine(req.user.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "My store reviews fetched successfully",
        data,
    });
});
const updateData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await vendor_review_service_1.vendorReviewServices.updateData(req.user.id, req.params.id, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Store review updated successfully",
        data,
    });
});
const deleteData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await vendor_review_service_1.vendorReviewServices.deleteData({ id: req.user.id, role: req.user.role }, req.params.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Store review deleted successfully",
        data,
    });
});
exports.vendorReviewControllers = {
    createIntoDB,
    findByVendorSlug,
    findMine,
    updateData,
    deleteData,
};
