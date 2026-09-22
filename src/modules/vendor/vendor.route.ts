import { Router } from "express";
import { Role } from "@/lib/prisma-client";
import { authGuard } from "@/middleware/authGuard";
import { validateRequest } from "@/middleware/validateRequest";
import { vendorControllers } from "./vendor.controller";
import { vendorValidation } from "./vendor.validation";

const router = Router();

/**
 * Route order matters: the literal `/me` and `/admin` segments are declared
 * before `/:slug`, otherwise Express would match "me" as a store slug.
 */

// ------------------------------------------------------------------ seller self
router.post(
    "/apply",
    // A CUSTOMER applies; an existing VENDOR is rejected by the service, and an
    // ADMIN may open a store too (their role is preserved on approval).
    authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN),
    validateRequest(vendorValidation.applySchema),
    vendorControllers.applyForVendor,
);

router
    .route("/me")
    .get(
        authGuard(Role.VENDOR, Role.ADMIN, Role.CUSTOMER),
        vendorControllers.getMyStore,
    )
    .patch(
        authGuard(Role.VENDOR, Role.ADMIN),
        validateRequest(vendorValidation.updateMyStoreSchema),
        vendorControllers.updateMyStore,
    );

router.get(
    "/me/dashboard",
    authGuard(Role.VENDOR, Role.ADMIN),
    vendorControllers.getMyDashboard,
);

// ----------------------------------------------------------------------- admin
router.get(
    "/admin/all",
    authGuard(Role.ADMIN),
    vendorControllers.findAllForAdmin,
);

router.get(
    "/admin/:id",
    authGuard(Role.ADMIN),
    vendorControllers.findByIdForAdmin,
);

router.patch(
    "/:id/approve",
    authGuard(Role.ADMIN),
    vendorControllers.approveVendor,
);

router.patch(
    "/:id/reject",
    authGuard(Role.ADMIN),
    validateRequest(vendorValidation.rejectVendorSchema),
    vendorControllers.rejectVendor,
);

router.patch(
    "/:id/suspend",
    authGuard(Role.ADMIN),
    validateRequest(vendorValidation.suspendVendorSchema),
    vendorControllers.suspendVendor,
);

router.patch(
    "/:id/reinstate",
    authGuard(Role.ADMIN),
    vendorControllers.reinstateVendor,
);

router.patch(
    "/:id/settings",
    authGuard(Role.ADMIN),
    validateRequest(vendorValidation.updateVendorSettingsSchema),
    vendorControllers.updateVendorSettings,
);

router.delete("/:id", authGuard(Role.ADMIN), vendorControllers.deleteVendor);

// ---------------------------------------------------------------------- public
router.get("/", vendorControllers.findAllPublic);
router.get("/:slug", vendorControllers.findBySlug);

export const vendorRouter = router;
