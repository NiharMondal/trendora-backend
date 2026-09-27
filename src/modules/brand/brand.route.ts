import { Router } from "express";

import { validateRequest } from "@/middleware/validateRequest";
import { brandControllers } from "./brand.controller";
import { brandSchema } from "./brand.validation";
import { authGuard } from "@/middleware/authGuard";
import { Role } from "@/lib/prisma-client";

const router = Router();

router
    .route("/:id")
    .get(brandControllers.findById)
    .patch(authGuard(Role.ADMIN), brandControllers.updateData)
    .delete(authGuard(Role.ADMIN), brandControllers.deleteData);

router
    .route("/")
    .post(
        authGuard(Role.ADMIN),
        validateRequest(brandSchema),
        brandControllers.createIntoDB,
    )
    .get(brandControllers.findAllFromDB);

export const brandRouter = router;
