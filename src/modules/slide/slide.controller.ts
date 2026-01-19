import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { slideServices } from "./slide.service";

const createIntoDB = asyncHandler(async (req: Request, res: Response) => {
    const data = await slideServices.createIntoDB(req.body);

    sendResponse(res, {
        statusCode: 201,
        message: "Slide created successfully",
        data: data,
    });
});

const findAllFromDB = asyncHandler(async (req: Request, res: Response) => {
    const { slide, meta } = await slideServices.findAllFromDB(req.query);

    sendResponse(res, {
        statusCode: 200,
        message: "Slide fetched successfully",
        meta: meta,
        data: slide,
    });
});
const findById = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    const data = await slideServices.findById(id);

    sendResponse(res, {
        statusCode: 200,
        message: "Slide fetched successfully",
        data: data,
    });
});

const updateData = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    const data = await slideServices.updateData(id, req.body);

    sendResponse(res, {
        statusCode: 200,
        message: "Slide updated successfully",
        data: data,
    });
});
const deleteData = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    const data = await slideServices.deleteData(id);

    sendResponse(res, {
        statusCode: 200,
        message: "Slide deleted successfully",
        data: data,
    });
});

export const slideControllers = {
    createIntoDB,
    findAllFromDB,
    findById,
    updateData,
    deleteData,
};
