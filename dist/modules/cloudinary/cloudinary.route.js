"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinaryRouter = void 0;
const express_1 = require("express");
const customError_1 = __importDefault(require("../../utils/customError"));
const cloudinary_1 = require("../../utils/cloudinary");
const router = (0, express_1.Router)();
router.post("/delete-temp", async (req, res) => {
    const { publicId } = req.body;
    if (!publicId.includes("/temp/")) {
        throw new customError_1.default(400, "Not a temp image");
    }
    ;
    await (0, cloudinary_1.deleteFromCloudinary)(publicId);
    return res.status(200).json({
        success: true,
        statusCode: 200,
        message: "Temp image deleted successfully",
    });
});
exports.cloudinaryRouter = router;
