"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wishlistControllers = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler");
const sendResponse_1 = require("../../utils/sendResponse");
const wishlist_service_1 = require("./wishlist.service");
const createIntoDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await wishlist_service_1.wishlistServices.createIntoDB(req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Wishlist added successfully",
        data: data,
    });
});
const findByUserId = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.user.id;
    const data = await wishlist_service_1.wishlistServices.findByUserId(id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Wishlist fetched successfully",
        data: data,
    });
});
const findById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await wishlist_service_1.wishlistServices.findById(id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Wishlist fetched successfully",
        data: data,
    });
});
const deleteData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await wishlist_service_1.wishlistServices.deleteData(id);
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
