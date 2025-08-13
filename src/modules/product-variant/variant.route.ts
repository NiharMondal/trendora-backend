import { Router } from "express";
import { variantController } from "./variant.controller";

const router = Router({ mergeParams: true });

router
	.route("/:productId/variants")
	.get(variantController.findByProductId)
	.post(variantController.addVariants);

export const variantRouter = router;
