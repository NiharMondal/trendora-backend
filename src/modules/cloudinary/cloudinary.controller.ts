import { Request, Response } from "express";

import { asyncHandler } from "@/utils/asyncHandler";
import { sendResponse } from "@/utils/sendResponse";

import { cloudinaryServices } from "./cloudinary.service";

const deleteTempImage = asyncHandler(async (req: Request, res: Response) => {
    await cloudinaryServices.deleteTempImage(req.body);

    sendResponse(res, {
        statusCode: 200,
        message: "Temp image deleted successfully",
        data: null,
    });
});

export const cloudinaryControllers = { deleteTempImage };
