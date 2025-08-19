"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendResponse = void 0;
const sendResponse = (res, obj) => {
    res.status(obj.statusCode).json({
        success: true,
        message: obj.message,
        meta: obj.meta,
        result: obj.data,
    });
};
exports.sendResponse = sendResponse;
