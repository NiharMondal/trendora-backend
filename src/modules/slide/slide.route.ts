import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";

import { authGuard } from "../../middleware/authGuard";
import { Role } from "../../../generated/prisma";
import { slideControllers } from "./slide.controller";
import { slideSchema } from "./slide.validation";

const router = Router();

router
    .route("/:id")
    .get(slideControllers.findById)
    .patch(authGuard(Role.ADMIN), slideControllers.updateData)
    .delete(slideControllers.deleteData);

router
    .route("/")
    .post(validateRequest(slideSchema), slideControllers.createIntoDB)
    .get(slideControllers.findAllFromDB);

export const slideRouter = router;
