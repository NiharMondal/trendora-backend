"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const express_1 = require("express");
const db_1 = require("../config/db.js");
const router = (0, express_1.Router)();
const startedAt = Date.now();
/**
 * Liveness: is this process up?
 *
 * Touches nothing external on purpose. An orchestrator uses liveness to decide
 * whether to **restart** the container, so it must not fail because a
 * dependency is down — restarting the app does not fix the database, and a
 * liveness probe wired to the database turns a brief DB blip into a restart
 * loop across every instance.
 */
router.get("/", (_req, res) => {
    res.status(200).json({
        status: "ok",
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    });
});
/**
 * Readiness: can this process actually serve traffic?
 *
 * This one *does* check the database, because readiness decides whether to send
 * **requests** — and an instance that cannot reach its database should be taken
 * out of the pool without being killed.
 *
 * Returns 503, not 500: the service is temporarily unable to serve, which is
 * what a load balancer needs to hear.
 */
router.get("/ready", async (_req, res) => {
    try {
        await db_1.prisma.$queryRaw `SELECT 1`;
        res.status(200).json({ status: "ready", database: "up" });
    }
    catch (error) {
        res.status(503).json({
            status: "not-ready",
            database: "down",
            // The message only, never the error object — this endpoint is
            // unauthenticated and a connection error carries the DSN.
            reason: error instanceof Error ? error.message : "unknown",
        });
    }
});
exports.healthRouter = router;
