"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsControllers = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler.js");
const sendResponse_1 = require("../../utils/sendResponse.js");
const settings_service_1 = require("./settings.service");
const getPlatformSettings = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const data = await settings_service_1.settingsServices.getPlatformSettings();
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Platform settings fetched successfully",
        data,
    });
});
exports.settingsControllers = { getPlatformSettings };
