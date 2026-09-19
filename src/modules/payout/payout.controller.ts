import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/sendResponse";
import { payoutServices } from "./payout.service";

const actorOf = (req: Request) => ({
    id: req.user.id as string,
    role: req.user.role as string,
});

const getMyBalance = asyncHandler(async (req: Request, res: Response) => {
    const data = await payoutServices.getMyBalance(
        actorOf(req),
        req.query.vendorId ? String(req.query.vendorId) : undefined,
    );

    sendResponse(res, {
        statusCode: 200,
        message: "Balance fetched successfully",
        data,
    });
});

const getMyPayouts = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await payoutServices.getMyPayouts(
        actorOf(req),
        req.query,
    );

    sendResponse(res, {
        statusCode: 200,
        message: "Payouts fetched successfully",
        data,
        meta,
    });
});

const findById = asyncHandler(async (req: Request, res: Response) => {
    const data = await payoutServices.findById(actorOf(req), req.params.id);

    sendResponse(res, {
        statusCode: 200,
        message: "Payout fetched successfully",
        data,
    });
});

const generatePayout = asyncHandler(async (req: Request, res: Response) => {
    const data = await payoutServices.generatePayout(req.body);

    sendResponse(res, {
        statusCode: 201,
        message: "Payout generated successfully",
        data,
    });
});

const markPaid = asyncHandler(async (req: Request, res: Response) => {
    const data = await payoutServices.markPaid(req.params.id, req.body);

    sendResponse(res, {
        statusCode: 200,
        message: "Payout marked as paid",
        data,
    });
});

const markFailed = asyncHandler(async (req: Request, res: Response) => {
    const data = await payoutServices.markFailed(req.params.id, req.body);

    sendResponse(res, {
        statusCode: 200,
        message: "Payout marked as failed and earnings released",
        data,
    });
});

const findAllForAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await payoutServices.findAllForAdmin(req.query);

    sendResponse(res, {
        statusCode: 200,
        message: "Payouts fetched successfully",
        data,
        meta,
    });
});

const getOutstandingBalances = asyncHandler(
    async (_req: Request, res: Response) => {
        const data = await payoutServices.getOutstandingBalances();

        sendResponse(res, {
            statusCode: 200,
            message: "Outstanding balances fetched successfully",
            data,
        });
    },
);

export const payoutControllers = {
    getMyBalance,
    getMyPayouts,
    findById,
    //
    generatePayout,
    markPaid,
    markFailed,
    findAllForAdmin,
    getOutstandingBalances,
};
