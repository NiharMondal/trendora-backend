import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";
import { brandControllers } from "./brand.controller";
import { brandSchema } from "./brand.validation";
import { authGuard } from "../../middleware/authGuard";
import { Role } from "../../../generated/prisma";

const router = Router();

router
    .route("/:id")
    .get(brandControllers.findById)
    .patch(authGuard(Role.ADMIN), brandControllers.updateData)
    .delete(brandControllers.deleteData);

router
    .route("/")
    .post(validateRequest(brandSchema), brandControllers.createIntoDB)
    .get(brandControllers.findAllFromDB);

export const brandRouter = router;
