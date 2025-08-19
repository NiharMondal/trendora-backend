"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundRoute = void 0;
const notFoundRoute = (req, res) => {
    res.status(404).json({
        success: false,
        status: 404,
        message: "Route is not found for " + req.originalUrl,
    });
};
exports.notFoundRoute = notFoundRoute;
