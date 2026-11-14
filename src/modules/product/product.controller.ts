import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendResponse } from "@/utils/sendResponse";
import { productServices } from "./product.service";

/** The authenticated caller, in the shape the vendor scoping helpers expect. */
const actorOf = (req: Request) => ({
    id: req.user.id as string,
    role: req.user.role as string,
});

const createIntoDB = asyncHandler(async (req: Request, res: Response) => {
    const data = await productServices.createIntoDB(actorOf(req), req.body);

    sendResponse(res, {
        statusCode: 201,
        message: "Product created successfully",
        data: data,
    });
});

const findAllFromDB = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await productServices.findAllFromDB(req.query);

    sendResponse(res, {
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
const findFilterFacets = asyncHandler(async (req: Request, res: Response) => {
    const data = await productServices.findFilterFacets(req.query);

    sendResponse(res, {
        statusCode: 200,
        message: "Product filters fetched successfully",
        data,
    });
});

const findById = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    const data = await productServices.findById(id);

    sendResponse(res, {
        statusCode: 200,
        message: "Product fetched successfully",
        data: data,
    });
});
const findBySlug = asyncHandler(async (req: Request, res: Response) => {
    const slug = req.params.slug;
    const data = await productServices.findBySlug(slug);

    sendResponse(res, {
        statusCode: 200,
        message: "Product fetched successfully",
        data: data,
    });
});

const updateData = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    const data = await productServices.updateData(actorOf(req), id, req.body);

    sendResponse(res, {
        statusCode: 200,
        message: "Product updated successfully",
        data: data,
    });
});
const deleteData = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    const data = await productServices.deleteData(actorOf(req), id);

    sendResponse(res, {
        statusCode: 200,
        message: "Product deleted successfully",
        data: data,
    });
});

const findMyProducts = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await productServices.findMyProducts(
        actorOf(req),
        req.query,
    );

    sendResponse(res, {
        statusCode: 200,
        message: "Products fetched successfully",
        data,
        meta,
    });
});

const findMyProductById = asyncHandler(async (req: Request, res: Response) => {
    const data = await productServices.findMyProductById(
        actorOf(req),
        req.params.id,
    );

    sendResponse(res, {
        statusCode: 200,
        message: "Product fetched successfully",
        data,
    });
});

const submitForReview = asyncHandler(async (req: Request, res: Response) => {
    const data = await productServices.submitForReview(
        actorOf(req),
        req.params.id,
    );

    sendResponse(res, {
        statusCode: 200,
        message: "Product submitted for review",
        data,
    });
});

const setPublished = asyncHandler(async (req: Request, res: Response) => {
    const data = await productServices.setPublished(
        actorOf(req),
        req.params.id,
        req.body.isPublished,
    );

    sendResponse(res, {
        statusCode: 200,
        message: req.body.isPublished
            ? "Product published"
            : "Product unpublished",
        data,
    });
});

const findAllForAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await productServices.findAllForAdmin(req.query);

    sendResponse(res, {
        statusCode: 200,
        message: "Products fetched successfully",
        data,
        meta,
    });
});

const approveProduct = asyncHandler(async (req: Request, res: Response) => {
    const data = await productServices.approveProduct(req.params.id);

    sendResponse(res, {
        statusCode: 200,
        message: "Product approved successfully",
        data,
    });
});

const rejectProduct = asyncHandler(async (req: Request, res: Response) => {
    const data = await productServices.rejectProduct(req.params.id, req.body);

    sendResponse(res, {
        statusCode: 200,
        message: "Product rejected",
        data,
    });
});

const newArrivalProducts = asyncHandler(async (req: Request, res: Response) => {
    const data = await productServices.newArrivalProducts();

    sendResponse(res, {
        statusCode: 200,
        message: "Product fetched successfully",
        data: data,
    });
});

const relatedProducts = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    const data = await productServices.relatedProducts(id);

    sendResponse(res, {
        statusCode: 200,
        message: "Related products fetched successfully",
        data: data,
    });
});

const findByVendorSlug = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await productServices.findByVendorSlug(
        req.params.slug,
        req.query,
    );

    sendResponse(res, {
        statusCode: 200,
        message: "Store products fetched successfully",
        data,
        meta,
    });
});

export const productControllers = {
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
    relatedProducts,
    findByVendorSlug,
};
