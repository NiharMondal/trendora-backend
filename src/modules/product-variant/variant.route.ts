import { Router } from "express";

import { Role } from "@/lib/prisma-client";
import { authGuard } from "@/middleware/authGuard";
import { validateRequest } from "@/middleware/validateRequest";

import { variantController } from "./variant.controller";
import { variantValidation } from "./variant.validation";

const router = Router({ mergeParams: true });

/**
 * Variants as a sub-resource of a product, mounted under /products.
 *
 * These exist so a vendor can restock, reprice or add a size without resending
 * the whole product: `PATCH /products/:id` replaces both collections wholesale
 * and deletes any row whose id the client failed to round-trip. Editing one
 * line here cannot touch the others.
 *
 * The GET is public and gated by the storefront's visibility rules, so it
 * cannot become a side door onto a draft listing's pricing. A vendor reads
 * their own unpublished listing through /products/vendor/my-products/:id,
 * which returns variants and images nested.
 */
router.get("/:productId/variants", variantController.findByProductId);

router.post(
    "/:productId/variants",
    authGuard(Role.VENDOR, Role.ADMIN),
    validateRequest(variantValidation.addVariantsSchema),
    variantController.addVariants,
);

router.patch(
    "/:productId/variants/:variantId",
    authGuard(Role.VENDOR, Role.ADMIN),
    validateRequest(variantValidation.updateVariantSchema),
    variantController.updateVariant,
);

router.delete(
    "/:productId/variants/:variantId",
    authGuard(Role.VENDOR, Role.ADMIN),
    variantController.deleteVariant,
);

export const variantRouter = router;
