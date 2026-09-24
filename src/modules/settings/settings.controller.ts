import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendResponse } from "@/utils/sendResponse";
import { settingsServices } from "./settings.service";

const getPlatformSettings = asyncHandler(async (_req: Request, res: Response) => {
    const data = await settingsServices.getPlatformSettings();

    sendResponse(res, {
        statusCode: 200,
        message: "Platform settings fetched successfully",
        data,
    });
});

export const settingsControllers = { getPlatformSettings };
