"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.variantController = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler.js");
const sendResponse_1 = require("../../utils/sendResponse.js");
const variant_service_1 = require("./variant.service");
/** The authenticated caller, in the shape the vendor scoping helpers expect. */
const actorOf = (req) => ({
    id: req.user.id,
    role: req.user.role,
});
const findByProductId = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const productId = req.params.productId;
    const data = await variant_service_1.variantServices.findByProductId(productId);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product variants fetched successfully",
        data: data,
    });
});
const addVariants = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await variant_service_1.variantServices.addVariants(actorOf(req), req.params.productId, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Variants added successfully",
        data: data,
    });
});
const updateVariant = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await variant_service_1.variantServices.updateVariant(actorOf(req), req.params.productId, req.params.variantId, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Variant updated successfully",
        data: data,
    });
});
const deleteVariant = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await variant_service_1.variantServices.deleteVariant(actorOf(req), req.params.productId, req.params.variantId);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Variant removed successfully",
        data: data,
    });
});
exports.variantController = {
    findByProductId,
    addVariants,
    updateVariant,
    deleteVariant,
};
