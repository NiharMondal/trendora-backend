import { Router } from "express";
import { productImageController } from "./image.controller";

const router = Router({ mergeParams: true });

router.get("/:productId/images", productImageController.findByProductId);

export const productImageRouter = router;
