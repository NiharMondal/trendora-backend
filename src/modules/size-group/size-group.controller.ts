import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { sizeGroupServices } from "./size-group.service";

const createIntoDB = asyncHandler(async (req: Request, res: Response) => {
    const data = await sizeGroupServices.createIntoDB(req.body);

    sendResponse(res, {
        statusCode: 201,
        message: "Size group created successfully",
        data: data,
    });
});

const findAllFromDB = asyncHandler(async (req: Request, res: Response) => {
    const slide = await sizeGroupServices.findAllFromDB();

    sendResponse(res, {
        statusCode: 200,
        message: "Size group fetched successfully",
        data: slide,
    });
});
const findById = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    const data = await sizeGroupServices.findById(id);

    sendResponse(res, {
        statusCode: 200,
        message: "Size group fetched successfully",
        data: data,
    });
});

const updateData = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    const data = await sizeGroupServices.updateData(id, req.body);

    sendResponse(res, {
        statusCode: 200,
        message: "Size group updated successfully",
        data: data,
    });
});
const deleteData = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    const data = await sizeGroupServices.deleteData(id);

    sendResponse(res, {
        statusCode: 200,
        message: "Size group deleted successfully",
        data: data,
    });
});

export const sizeGroupControllers = {
    createIntoDB,
    findAllFromDB,
    findById,
    updateData,
    deleteData,
};
