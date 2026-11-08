"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wishlistControllers = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler.js");
const sendResponse_1 = require("../../utils/sendResponse.js");
const wishlist_service_1 = require("./wishlist.service");
// The owner always comes from the verified JWT, never from the body — see the
// note in wishlist.validation.ts. The two single-row handlers below pass it to
// the service for the same reason; dropping that argument reopens the IDOR
// these routes used to have (docs/FEATURE-GAPS.md BE-03).
const createIntoDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await wishlist_service_1.wishlistServices.createIntoDB(req.body, req.user.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Wishlist added successfully",
        data: data,
    });
});
const findByUserId = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.user.id;
    const { wishlists, meta } = await wishlist_service_1.wishlistServices.findByUserId(id, req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Wishlist fetched successfully",
        meta: meta,
        data: wishlists,
    });
});
const findById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await wishlist_service_1.wishlistServices.findById(id, req.user.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Wishlist fetched successfully",
        data: data,
    });
});
const deleteData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await wishlist_service_1.wishlistServices.deleteData(id, req.user.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Wishlist deleted successfully",
        data: data,
    });
});
exports.wishlistControllers = {
    createIntoDB,
    findByUserId,
    findById,
    deleteData,
};
