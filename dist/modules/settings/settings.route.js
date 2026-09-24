"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsRouter = void 0;
const express_1 = require("express");
const prisma_client_1 = require("../../lib/prisma-client.js");
const authGuard_1 = require("../../middleware/authGuard.js");
const settings_controller_1 = require("./settings.controller");
const router = (0, express_1.Router)();
/**
 * Read-only. The values are environment configuration, and some of them are
 * mirrored on the frontend, so there is deliberately no write route.
 */
router.get("/", (0, authGuard_1.authGuard)(prisma_client_1.Role.ADMIN), settings_controller_1.settingsControllers.getPlatformSettings);
exports.settingsRouter = router;
