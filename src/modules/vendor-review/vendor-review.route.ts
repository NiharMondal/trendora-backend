import { Router } from "express";
import { Role } from "../../../generated/prisma";
import { authGuard } from "../../middleware/authGuard";
import { validateRequest } from "../../middleware/validateRequest";
import { vendorReviewControllers } from "./vendor-review.controller";
import { vendorReviewValidation } from "./vendor-review.validation";

const router = Router();

router.get(
    "/my-reviews",
    authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN),
    vendorReviewControllers.findMine,
);

router.get("/store/:slug", vendorReviewControllers.findByVendorSlug);

router
    .route("/:id")
    .patch(
        authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN),
        validateRequest(vendorReviewValidation.updateVendorReviewSchema),
        vendorReviewControllers.updateData,
    )
    .delete(
        authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN),
        vendorReviewControllers.deleteData,
    );

router.post(
    "/",
    authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN),
    validateRequest(vendorReviewValidation.createVendorReviewSchema),
    vendorReviewControllers.createIntoDB,
);

export const vendorReviewRouter = router;
