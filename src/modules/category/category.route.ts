import { Router } from "express";
import { categoryControllers } from "./category.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { categorySchema } from "./category.validation";

const router = Router();

router
    .route("/:id")
    .get(categoryControllers.findById)
    .patch(categoryControllers.updateData)
    .delete(categoryControllers.deleteData);

router
    .route("/")
    .post(validateRequest(categorySchema), categoryControllers.createIntoDB)
    .get(categoryControllers.findAllFromDB);

export const categoryRouter = router;
