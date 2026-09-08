import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { vendorReviewServices } from "./vendor-review.service";

const createIntoDB = asyncHandler(async (req: Request, res: Response) => {
    const data = await vendorReviewServices.createIntoDB(
        req.user.id,
        req.body,
    );

    sendResponse(res, {
        statusCode: 201,
        message: "Store review submitted successfully",
        data,
    });
});

const findByVendorSlug = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await vendorReviewServices.findByVendorSlug(
        req.params.slug,
        req.query,
    );

    sendResponse(res, {
        statusCode: 200,
        message: "Store reviews fetched successfully",
        data,
        meta,
    });
});

const findMine = asyncHandler(async (req: Request, res: Response) => {
    const data = await vendorReviewServices.findMine(req.user.id);

    sendResponse(res, {
        statusCode: 200,
        message: "My store reviews fetched successfully",
        data,
    });
});

const updateData = asyncHandler(async (req: Request, res: Response) => {
    const data = await vendorReviewServices.updateData(
        req.user.id,
        req.params.id,
        req.body,
    );

    sendResponse(res, {
        statusCode: 200,
        message: "Store review updated successfully",
        data,
    });
});

const deleteData = asyncHandler(async (req: Request, res: Response) => {
    const data = await vendorReviewServices.deleteData(
        { id: req.user.id, role: req.user.role },
        req.params.id,
    );

    sendResponse(res, {
        statusCode: 200,
        message: "Store review deleted successfully",
        data,
    });
});

export const vendorReviewControllers = {
    createIntoDB,
    findByVendorSlug,
    findMine,
    updateData,
    deleteData,
};
