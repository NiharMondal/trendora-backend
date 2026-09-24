import { Router } from "express";
import { Role } from "@/lib/prisma-client";
import { authGuard } from "@/middleware/authGuard";
import { settingsControllers } from "./settings.controller";

const router = Router();

/**
 * Read-only. The values are environment configuration, and some of them are
 * mirrored on the frontend, so there is deliberately no write route.
 */
router.get("/", authGuard(Role.ADMIN), settingsControllers.getPlatformSettings);

export const settingsRouter = router;
