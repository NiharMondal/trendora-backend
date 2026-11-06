"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productImageController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler.js");
const sendResponse_1 = require("../../utils/sendResponse.js");
const image_service_1 = require("./image.service");
/** The authenticated caller, in the shape the vendor scoping helpers expect. */
const actorOf = (req) => ({
    id: req.user.id,
    role: req.user.role,
});
/**
 * Adding or removing imagery re-opens moderation on an approved listing, so say
 * so — otherwise a vendor watches their live product quietly drop back to
 * Pending with no explanation.
 */
const reviewNotice = (sentBackForReview) => sentBackForReview
    ? " Your listing has gone back for review because its images changed."
    : "";
const findByProductId = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const productId = req.params.productId;
    const data = await image_service_1.productImageServices.findByProductId(productId);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product images fetched successfully",
        data: data,
    });
});
const addImages = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { images, sentBackForReview } = await image_service_1.productImageServices.addImages(actorOf(req), req.params.productId, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: `Images added successfully.${reviewNotice(sentBackForReview)}`,
        data: images,
    });
});
const updateImage = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await image_service_1.productImageServices.updateImage(actorOf(req), req.params.productId, req.params.imageId, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Image updated successfully",
        data: data,
    });
});
const deleteImage = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { images, sentBackForReview } = await image_service_1.productImageServices.deleteImage(actorOf(req), req.params.productId, req.params.imageId);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: `Image removed successfully.${reviewNotice(sentBackForReview)}`,
        data: images,
    });
});
exports.productImageController = {
    findByProductId,
    addImages,
    updateImage,
    deleteImage,
};
