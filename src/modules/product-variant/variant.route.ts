import { Router } from "express";
import { variantController } from "./variant.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { variantValidation } from "./variant.validation";

const router = Router({ mergeParams: true });

router
	.route("/:productId/variants")
	.get(variantController.findByProductId)
	.post(
		validateRequest(variantValidation.addVariants),
		variantController.addVariants
	);

export const variantRouter = router;
