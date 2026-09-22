import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendResponse } from "@/utils/sendResponse";
import { refundServices } from "./refund.service";

const actorOf = (req: Request) => ({
    id: req.user.id as string,
    role: req.user.role as string,
});

const findAllForAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await refundServices.findAllForAdmin(req.query);

    sendResponse(res, {
        statusCode: 200,
        message: "Refunds fetched successfully",
        data,
        meta,
    });
});

const getOutstanding = asyncHandler(async (_req: Request, res: Response) => {
    const data = await refundServices.getOutstanding();

    sendResponse(res, {
        statusCode: 200,
        message: "Outstanding refunds fetched successfully",
        data,
    });
});

const findMine = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await refundServices.findMine(
        actorOf(req),
        req.query,
    );

    sendResponse(res, {
        statusCode: 200,
        message: "Refunds fetched successfully",
        data,
        meta,
    });
});

const findById = asyncHandler(async (req: Request, res: Response) => {
    const data = await refundServices.findById(req.params.id);

    sendResponse(res, {
        statusCode: 200,
        message: "Refund fetched successfully",
        data,
    });
});

const retry = asyncHandler(async (req: Request, res: Response) => {
    const data = await refundServices.retry(req.params.id);

    sendResponse(res, {
        statusCode: 200,
        message:
            data.status === "SUCCEEDED"
                ? "Refund issued successfully"
                : `Refund is now ${data.status.toLowerCase()}`,
        data,
    });
});

const retryAll = asyncHandler(async (_req: Request, res: Response) => {
    const data = await refundServices.retryAll();

    sendResponse(res, {
        statusCode: 200,
        message: `Attempted ${data.attempted} refund(s): ${data.succeeded} succeeded, ${data.failed} failed`,
        data,
    });
});

const manual = asyncHandler(async (req: Request, res: Response) => {
    const data = await refundServices.manual(req.body);

    sendResponse(res, {
        statusCode: 201,
        message: "Manual refund recorded",
        data,
    });
});

const cancel = asyncHandler(async (req: Request, res: Response) => {
    const data = await refundServices.cancel(req.params.id, req.body);

    sendResponse(res, {
        statusCode: 200,
        message: "Refund cancelled",
        data,
    });
});

export const refundControllers = {
    findAllForAdmin,
    getOutstanding,
    findMine,
    findById,
    retry,
    retryAll,
    manual,
    cancel,
};
