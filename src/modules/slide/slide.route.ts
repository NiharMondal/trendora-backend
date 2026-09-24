import { Router } from "express";

import { validateRequest } from "@/middleware/validateRequest";

import { authGuard } from "@/middleware/authGuard";
import { Role } from "@/lib/prisma-client";
import { slideControllers } from "./slide.controller";
import { slideSchema, slideUpdateSchema } from "./slide.validation";

const router = Router();

/**
 * MUST stay above `/:id`, or Express matches "admin" as an id.
 *
 * The public `GET /` hides deactivated slides, so an admin needs its own
 * listing to find them again — same split as `/products/admin/all`.
 */
router.get(
    "/admin/all",
    authGuard(Role.ADMIN),
    slideControllers.findAllForAdmin,
);

router
    .route("/:id")
    .get(slideControllers.findById)
    .patch(
        authGuard(Role.ADMIN),
        validateRequest(slideUpdateSchema),
        slideControllers.updateData,
    )
    .delete(authGuard(Role.ADMIN), slideControllers.deleteData);

router
    .route("/")
    .post(
        authGuard(Role.ADMIN),
        validateRequest(slideSchema),
        slideControllers.createIntoDB,
    )
    .get(slideControllers.findAllFromDB);

export const slideRouter = router;
