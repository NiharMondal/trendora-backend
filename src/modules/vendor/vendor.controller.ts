import { Request, Response } from "express";
import { parseDateRange } from "@/helpers/date-range";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendResponse } from "@/utils/sendResponse";
import { vendorServices } from "./vendor.service";

/**
 * The admin taking a moderation action, for the audit trail. `req.ip` is what
 * `trust proxy` in app.ts makes meaningful behind a load balancer.
 */
const moderatorOf = (req: Request) => ({
    id: req.user.id as string,
    ipAddress: req.ip,
});

const applyForVendor = asyncHandler(async (req: Request, res: Response) => {
    const data = await vendorServices.applyForVendor(req.user.id, req.body);

    sendResponse(res, {
        statusCode: 201,
        message: "Vendor application submitted. An admin will review it shortly.",
        data,
    });
});

const getMyStore = asyncHandler(async (req: Request, res: Response) => {
    const data = await vendorServices.getMyStore(req.user.id);

    sendResponse(res, {
        statusCode: 200,
        message: "Store fetched successfully",
        data,
    });
});

const updateMyStore = asyncHandler(async (req: Request, res: Response) => {
    const data = await vendorServices.updateMyStore(req.user.id, req.body);

    sendResponse(res, {
        statusCode: 200,
        message: "Store updated successfully",
        data,
    });
});

const getMyDashboard = asyncHandler(async (req: Request, res: Response) => {
    const data = await vendorServices.getMyDashboard(
        req.user.id,
        parseDateRange(req.query),
    );

    sendResponse(res, {
        statusCode: 200,
        message: "Vendor dashboard fetched successfully",
        data,
    });
});

const findAllPublic = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await vendorServices.findAllPublic(req.query);

    sendResponse(res, {
        statusCode: 200,
        message: "Stores fetched successfully",
        data,
        meta,
    });
});

const findBySlug = asyncHandler(async (req: Request, res: Response) => {
    const data = await vendorServices.findBySlug(req.params.slug);

    sendResponse(res, {
        statusCode: 200,
        message: "Store fetched successfully",
        data,
    });
});

const findAllForAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { data, meta } = await vendorServices.findAllForAdmin(req.query);

    sendResponse(res, {
        statusCode: 200,
        message: "Vendors fetched successfully",
        data,
        meta,
    });
});

const findByIdForAdmin = asyncHandler(async (req: Request, res: Response) => {
    const data = await vendorServices.findByIdForAdmin(req.params.id);

    sendResponse(res, {
        statusCode: 200,
        message: "Vendor fetched successfully",
        data,
    });
});

const approveVendor = asyncHandler(async (req: Request, res: Response) => {
    const data = await vendorServices.approveVendor(req.params.id, moderatorOf(req));

    sendResponse(res, {
        statusCode: 200,
        message: "Vendor approved successfully",
        data,
    });
});

const rejectVendor = asyncHandler(async (req: Request, res: Response) => {
    const data = await vendorServices.rejectVendor(req.params.id, req.body, moderatorOf(req));

    sendResponse(res, {
        statusCode: 200,
        message: "Vendor application rejected",
        data,
    });
});

const suspendVendor = asyncHandler(async (req: Request, res: Response) => {
    const data = await vendorServices.suspendVendor(req.params.id, req.body, moderatorOf(req));

    sendResponse(res, {
        statusCode: 200,
        message: "Vendor suspended",
        data,
    });
});

const reinstateVendor = asyncHandler(async (req: Request, res: Response) => {
    const data = await vendorServices.reinstateVendor(req.params.id, moderatorOf(req));

    sendResponse(res, {
        statusCode: 200,
        message: "Vendor reinstated",
        data,
    });
});

const updateVendorSettings = asyncHandler(
    async (req: Request, res: Response) => {
        const data = await vendorServices.updateVendorSettings(
            req.params.id,
            req.body,
            moderatorOf(req),
        );

        sendResponse(res, {
            statusCode: 200,
            message: "Vendor settings updated",
            data,
        });
    },
);

const deleteVendor = asyncHandler(async (req: Request, res: Response) => {
    const data = await vendorServices.deleteVendor(req.params.id, moderatorOf(req));

    sendResponse(res, {
        statusCode: 200,
        message: "Vendor deleted successfully",
        data,
    });
});

export const vendorControllers = {
    applyForVendor,
    getMyStore,
    updateMyStore,
    getMyDashboard,
    //
    findAllPublic,
    findBySlug,
    //
    findAllForAdmin,
    findByIdForAdmin,
    approveVendor,
    rejectVendor,
    suspendVendor,
    reinstateVendor,
    updateVendorSettings,
    deleteVendor,
};
