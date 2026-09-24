"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorControllers = void 0;
const date_range_1 = require("../../helpers/date-range.js");
const asyncHandler_1 = require("../../utils/asyncHandler.js");
const sendResponse_1 = require("../../utils/sendResponse.js");
const vendor_service_1 = require("./vendor.service");
/**
 * The admin taking a moderation action, for the audit trail. `req.ip` is what
 * `trust proxy` in app.ts makes meaningful behind a load balancer.
 */
const moderatorOf = (req) => ({
    id: req.user.id,
    ipAddress: req.ip,
});
const applyForVendor = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await vendor_service_1.vendorServices.applyForVendor(req.user.id, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Vendor application submitted. An admin will review it shortly.",
        data,
    });
});
const getMyStore = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await vendor_service_1.vendorServices.getMyStore(req.user.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Store fetched successfully",
        data,
    });
});
const updateMyStore = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await vendor_service_1.vendorServices.updateMyStore(req.user.id, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Store updated successfully",
        data,
    });
});
const getMyDashboard = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await vendor_service_1.vendorServices.getMyDashboard(req.user.id, (0, date_range_1.parseDateRange)(req.query));
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Vendor dashboard fetched successfully",
        data,
    });
});
const findAllPublic = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { data, meta } = await vendor_service_1.vendorServices.findAllPublic(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Stores fetched successfully",
        data,
        meta,
    });
});
const findBySlug = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await vendor_service_1.vendorServices.findBySlug(req.params.slug);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Store fetched successfully",
        data,
    });
});
const findAllForAdmin = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { data, meta } = await vendor_service_1.vendorServices.findAllForAdmin(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Vendors fetched successfully",
        data,
        meta,
    });
});
const findByIdForAdmin = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await vendor_service_1.vendorServices.findByIdForAdmin(req.params.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Vendor fetched successfully",
        data,
    });
});
const approveVendor = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await vendor_service_1.vendorServices.approveVendor(req.params.id, moderatorOf(req));
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Vendor approved successfully",
        data,
    });
});
const rejectVendor = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await vendor_service_1.vendorServices.rejectVendor(req.params.id, req.body, moderatorOf(req));
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Vendor application rejected",
        data,
    });
});
const suspendVendor = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await vendor_service_1.vendorServices.suspendVendor(req.params.id, req.body, moderatorOf(req));
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Vendor suspended",
        data,
    });
});
const reinstateVendor = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await vendor_service_1.vendorServices.reinstateVendor(req.params.id, moderatorOf(req));
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Vendor reinstated",
        data,
    });
});
const updateVendorSettings = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await vendor_service_1.vendorServices.updateVendorSettings(req.params.id, req.body, moderatorOf(req));
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Vendor settings updated",
        data,
    });
});
const deleteVendor = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await vendor_service_1.vendorServices.deleteVendor(req.params.id, moderatorOf(req));
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Vendor deleted successfully",
        data,
    });
});
exports.vendorControllers = {
    applyForVendor,
    getMyStore,
    updateMyStore,
    getMyDashboard,
    //
    findAllPublic,
    findBySlug,
    //
    findAllForAdmin,
    findByIdForAdmin,
    approveVendor,
    rejectVendor,
    suspendVendor,
    reinstateVendor,
    updateVendorSettings,
    deleteVendor,
};
