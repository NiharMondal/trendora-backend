import { Router } from "express";

import { Role } from "@/lib/prisma-client";
import { authGuard } from "@/middleware/authGuard";
import { validateRequest } from "@/middleware/validateRequest";

import { productImageController } from "./image.controller";
import { imageValidation } from "./image.validation";

const router = Router({ mergeParams: true });

/**
 * Images as a sub-resource of a product, mounted under /products.
 *
 * The reason these are worth having rather than folding into
 * `PATCH /products/:id`: that route takes the whole images array and deletes
 * any row whose id the client did not round-trip — **destroying the Cloudinary
 * asset with it**. Removing one picture here cannot take another with it.
 *
 * The GET is public and gated by the storefront's visibility rules.
 */
router.get("/:productId/images", productImageController.findByProductId);

router.post(
    "/:productId/images",
    authGuard(Role.VENDOR, Role.ADMIN),
    validateRequest(imageValidation.addImagesSchema),
    productImageController.addImages,
);

router.patch(
    "/:productId/images/:imageId",
    authGuard(Role.VENDOR, Role.ADMIN),
    validateRequest(imageValidation.updateImageSchema),
    productImageController.updateImage,
);

router.delete(
    "/:productId/images/:imageId",
    authGuard(Role.VENDOR, Role.ADMIN),
    productImageController.deleteImage,
);

export const productImageRouter = router;
