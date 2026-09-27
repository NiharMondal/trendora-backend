import { Router } from "express";
import { Role } from "@/lib/prisma-client";
import { authGuard } from "@/middleware/authGuard";
import { validateRequest } from "@/middleware/validateRequest";
import { payoutControllers } from "./payout.controller";
import { payoutValidation } from "./payout.validation";

const router = Router();

// ---------------------------------------------------------------------- vendor
router.get(
    "/me/balance",
    authGuard(Role.VENDOR, Role.ADMIN),
    payoutControllers.getMyBalance,
);

router.get(
    "/me",
    authGuard(Role.VENDOR, Role.ADMIN),
    payoutControllers.getMyPayouts,
);

// ----------------------------------------------------------------------- admin
router.get(
    "/admin/outstanding",
    authGuard(Role.ADMIN),
    payoutControllers.getOutstandingBalances,
);

router.get(
    "/admin/all",
    authGuard(Role.ADMIN),
    payoutControllers.findAllForAdmin,
);

router.post(
    "/generate",
    authGuard(Role.ADMIN),
    validateRequest(payoutValidation.generatePayoutSchema),
    payoutControllers.generatePayout,
);

router.patch(
    "/:id/mark-paid",
    authGuard(Role.ADMIN),
    validateRequest(payoutValidation.markPaidSchema),
    payoutControllers.markPaid,
);

router.patch(
    "/:id/mark-failed",
    authGuard(Role.ADMIN),
    validateRequest(payoutValidation.markFailedSchema),
    payoutControllers.markFailed,
);

// Vendor or admin; the service checks ownership.
router.get(
    "/:id",
    authGuard(Role.VENDOR, Role.ADMIN),
    payoutControllers.findById,
);

export const payoutRouter = router;
