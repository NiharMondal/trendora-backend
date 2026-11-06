"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinaryControllers = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler.js");
const sendResponse_1 = require("../../utils/sendResponse.js");
const cloudinary_service_1 = require("./cloudinary.service");
const deleteTempImage = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await cloudinary_service_1.cloudinaryServices.deleteTempImage(req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Temp image deleted successfully",
        data: null,
    });
});
exports.cloudinaryControllers = { deleteTempImage };
