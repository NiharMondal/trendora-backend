import { Router } from "express";
import { variantController } from "./variant.controller";

const router = Router({ mergeParams: true });

router.get("/:productId/variants", variantController.findByProductId);

export const variantRouter = router;
