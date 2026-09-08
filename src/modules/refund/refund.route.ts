import { Router } from "express";
import { Role } from "../../../generated/prisma";
import { authGuard } from "../../middleware/authGuard";
import { validateRequest } from "../../middleware/validateRequest";
import { refundControllers } from "./refund.controller";
import { refundValidation } from "./refund.validation";

const router = Router();

/**
 * Refunds are issued automatically when a paid parcel is cancelled. These
 * endpoints cover what automation cannot: retrying a gateway failure,
 * recording money returned by hand, and abandoning a refund.
 *
 * Every mutation is ADMIN-only — moving money back to a buyer is not a seller
 * decision, and a seller cancelling a parcel already triggers the refund.
 */

// ------------------------------------------------------- buyer / seller reads
router.get(
    "/me",
    // A buyer sees refunds on their orders; a vendor sees refunds on their own
    // parcels. The service picks the scope from the role.
    authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN),
    refundControllers.findMine,
);

// ----------------------------------------------------------------------- admin
router.get(
    "/admin/outstanding",
    authGuard(Role.ADMIN),
    refundControllers.getOutstanding,
);

router.get(
    "/admin/all",
    authGuard(Role.ADMIN),
    refundControllers.findAllForAdmin,
);

router.post(
    "/manual",
    authGuard(Role.ADMIN),
    validateRequest(refundValidation.manualRefundSchema),
    refundControllers.manual,
);

router.post("/retry-all", authGuard(Role.ADMIN), refundControllers.retryAll);

router.patch("/:id/retry", authGuard(Role.ADMIN), refundControllers.retry);

router.patch(
    "/:id/cancel",
    authGuard(Role.ADMIN),
    validateRequest(refundValidation.cancelRefundSchema),
    refundControllers.cancel,
);

router.get("/:id", authGuard(Role.ADMIN), refundControllers.findById);

export const refundRouter = router;
