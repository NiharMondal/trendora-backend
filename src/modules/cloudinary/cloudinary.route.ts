import { Router } from "express";

import { validateRequest } from "@/middleware/validateRequest";

import { cloudinaryControllers } from "./cloudinary.controller";
import { cloudinaryValidation } from "./cloudinary.validation";

const router = Router();

/**
 * Deliberately unauthenticated: the frontend's `deleteTempImage` is a raw
 * `fetch` with no token, one of the two exceptions to "all server data goes
 * through RTK Query". Adding `authGuard` here alone turns every image replace
 * into a silent 401 — it is a two-sided change (BE-04 / BE-42).
 */
router.post(
    "/delete-temp",
    validateRequest(cloudinaryValidation.deleteTempSchema),
    cloudinaryControllers.deleteTempImage,
);

export const cloudinaryRouter = router;
