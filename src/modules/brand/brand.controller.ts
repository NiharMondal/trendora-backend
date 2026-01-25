import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { brandServices } from "./brand.service";

const createIntoDB = asyncHandler(async (req: Request, res: Response) => {
    const data = await brandServices.createIntoDB(req.body);

    sendResponse(res, {
        statusCode: 201,
        message: "Brand created successfully",
        data: data,
    });
});

const findAllFromDB = asyncHandler(async (req: Request, res: Response) => {
    const { brand, meta } = await brandServices.findAllFromDB(req.query);

    sendResponse(res, {
        statusCode: 200,
        message: "Brand fetched successfully",
        meta: meta,
        data: brand,
    });
});
const findById = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    const data = await brandServices.findById(id);

    sendResponse(res, {
        statusCode: 200,
        message: "Brand fetched successfully",
        data: data,
    });
});

const updateData = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    const data = await brandServices.updateData(id, req.body);

    sendResponse(res, {
        statusCode: 200,
        message: "Brand updated successfully",
        data: data,
    });
});
const deleteData = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    const data = await brandServices.deleteData(id);

    sendResponse(res, {
        statusCode: 200,
        message: "Brand deleted successfully",
        data: data,
    });
});

export const brandControllers = {
    createIntoDB,
    findAllFromDB,
    findById,
    updateData,
    deleteData,
};
