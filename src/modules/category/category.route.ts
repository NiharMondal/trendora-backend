import { Router } from "express";
import { categoryControllers } from "./category.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { categorySchema } from "./category.validation";
import { authGuard } from "../../middleware/authGuard";
import { Role } from "../../../generated/prisma";

const router = Router();

router
    .route("/:id")
    .get(categoryControllers.findById)
    .patch(authGuard(Role.ADMIN), categoryControllers.updateData)
    .delete(authGuard(Role.ADMIN), categoryControllers.deleteData);

router
    .route("/")
    .post(
        authGuard(Role.ADMIN),
        validateRequest(categorySchema),
        categoryControllers.createIntoDB,
    )
    .get(categoryControllers.findAllFromDB);

export const categoryRouter = router;
