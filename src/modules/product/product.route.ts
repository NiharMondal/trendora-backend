import { Router } from "express";
import { productControllers } from "./product.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { productSchema } from "./product.validation";

const router = Router();

router.get("/new-arrival", productControllers.newArrivalProducts);
router.get("/by-slug/:slug", productControllers.findBySlug);

router
    .route("/:id")
    .get(productControllers.findById)
    .patch(productControllers.updateData)
    .delete(productControllers.deleteData);

router
    .route("/")
    .post(validateRequest(productSchema), productControllers.createIntoDB)
    .get(productControllers.findAllFromDB);

export const productRouter = router;
