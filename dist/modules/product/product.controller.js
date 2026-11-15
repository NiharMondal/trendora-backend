"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productControllers = void 0;
const asyncHandler_1 = require("../../utils/asyncHandler.js");
const sendResponse_1 = require("../../utils/sendResponse.js");
const product_service_1 = require("./product.service");
/** The authenticated caller, in the shape the vendor scoping helpers expect. */
const actorOf = (req) => ({
    id: req.user.id,
    role: req.user.role,
});
const createIntoDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await product_service_1.productServices.createIntoDB(actorOf(req), req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 201,
        message: "Product created successfully",
        data: data,
    });
});
const findAllFromDB = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { data, meta } = await product_service_1.productServices.findAllFromDB(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product fetched successfully",
        data,
        meta,
    });
});
/**
 * The storefront filter panel's options, derived from the live catalogue.
 * Takes the same query params as the listing so the counts reflect what the
 * shopper has already narrowed to.
 */
const findFilterFacets = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await product_service_1.productServices.findFilterFacets(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product filters fetched successfully",
        data,
    });
});
/** The storefront's best-sellers rail. Public; takes ?limit= and ?days=. */
const bestSellingProducts = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await product_service_1.productServices.bestSellingProducts(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Best selling products fetched successfully",
        data,
    });
});
const findById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await product_service_1.productServices.findById(id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product fetched successfully",
        data: data,
    });
});
const findBySlug = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const slug = req.params.slug;
    const data = await product_service_1.productServices.findBySlug(slug);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product fetched successfully",
        data: data,
    });
});
const updateData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await product_service_1.productServices.updateData(actorOf(req), id, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product updated successfully",
        data: data,
    });
});
const deleteData = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await product_service_1.productServices.deleteData(actorOf(req), id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product deleted successfully",
        data: data,
    });
});
const findMyProducts = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { data, meta } = await product_service_1.productServices.findMyProducts(actorOf(req), req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Products fetched successfully",
        data,
        meta,
    });
});
const findMyProductById = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await product_service_1.productServices.findMyProductById(actorOf(req), req.params.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product fetched successfully",
        data,
    });
});
const submitForReview = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await product_service_1.productServices.submitForReview(actorOf(req), req.params.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product submitted for review",
        data,
    });
});
const setPublished = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await product_service_1.productServices.setPublished(actorOf(req), req.params.id, req.body.isPublished);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: req.body.isPublished
            ? "Product published"
            : "Product unpublished",
        data,
    });
});
const findAllForAdmin = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { data, meta } = await product_service_1.productServices.findAllForAdmin(req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Products fetched successfully",
        data,
        meta,
    });
});
const approveProduct = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await product_service_1.productServices.approveProduct(req.params.id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product approved successfully",
        data,
    });
});
const rejectProduct = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await product_service_1.productServices.rejectProduct(req.params.id, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product rejected",
        data,
    });
});
const newArrivalProducts = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = await product_service_1.productServices.newArrivalProducts();
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Product fetched successfully",
        data: data,
    });
});
const relatedProducts = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const data = await product_service_1.productServices.relatedProducts(id);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Related products fetched successfully",
        data: data,
    });
});
const findByVendorSlug = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { data, meta } = await product_service_1.productServices.findByVendorSlug(req.params.slug, req.query);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: 200,
        message: "Store products fetched successfully",
        data,
        meta,
    });
});
exports.productControllers = {
    createIntoDB,
    findAllFromDB,
    findFilterFacets,
    findById,
    findBySlug,
    updateData,
    deleteData,
    //
    findMyProducts,
    findMyProductById,
    submitForReview,
    setPublished,
    //
    findAllForAdmin,
    approveProduct,
    rejectProduct,
    //
    newArrivalProducts,
    bestSellingProducts,
    relatedProducts,
    findByVendorSlug,
};
