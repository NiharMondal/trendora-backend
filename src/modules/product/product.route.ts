import { Router } from "express";
import { Role } from "@/lib/prisma-client";
import { authGuard } from "@/middleware/authGuard";
import { validateRequest } from "@/middleware/validateRequest";
import { productControllers } from "./product.controller";
import { productValidation } from "./product.validation";

const router = Router();

/**
 * Literal segments are declared before `/:id` so Express does not match
 * "vendor" or "admin" as a product id.
 *
 * Before the marketplace conversion every write here was UNAUTHENTICATED —
 * anyone could create, edit or delete any product. Writes are now
 * role-guarded, and the service additionally checks row ownership: a VENDOR
 * may only touch their own listings.
 */

// ---------------------------------------------------------------------- public
router.get("/filters", productControllers.findFilterFacets);
router.get("/new-arrival", productControllers.newArrivalProducts);
router.get("/by-slug/:slug", productControllers.findBySlug);
router.get("/related-products/:id", productControllers.relatedProducts);
router.get("/store/:slug", productControllers.findByVendorSlug);

// ------------------------------------------------------------- vendor (own)
router.get(
    "/vendor/my-products",
    authGuard(Role.VENDOR, Role.ADMIN),
    productControllers.findMyProducts,
);

router.get(
    "/vendor/my-products/:id",
    authGuard(Role.VENDOR, Role.ADMIN),
    productControllers.findMyProductById,
);

router.patch(
    "/:id/submit",
    authGuard(Role.VENDOR, Role.ADMIN),
    productControllers.submitForReview,
);

router.patch(
    "/:id/publish",
    authGuard(Role.VENDOR, Role.ADMIN),
    validateRequest(productValidation.publishProductSchema),
    productControllers.setPublished,
);

// ----------------------------------------------------------------------- admin
router.get(
    "/admin/all",
    authGuard(Role.ADMIN),
    productControllers.findAllForAdmin,
);

router.patch(
    "/:id/approve",
    authGuard(Role.ADMIN),
    productControllers.approveProduct,
);

router.patch(
    "/:id/reject",
    authGuard(Role.ADMIN),
    validateRequest(productValidation.rejectProductSchema),
    productControllers.rejectProduct,
);

// ------------------------------------------------------------------ crud
router
    .route("/:id")
    .get(productControllers.findById)
    .patch(
        authGuard(Role.VENDOR, Role.ADMIN),
        validateRequest(productValidation.updateProductSchema),
        productControllers.updateData,
    )
    .delete(
        authGuard(Role.VENDOR, Role.ADMIN),
        productControllers.deleteData,
    );

router
    .route("/")
    .post(
        authGuard(Role.VENDOR, Role.ADMIN),
        validateRequest(productValidation.productSchema),
        productControllers.createIntoDB,
    )
    .get(productControllers.findAllFromDB);

export const productRouter = router;
