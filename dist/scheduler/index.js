"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledJobs = exports.stopScheduler = exports.startScheduler = exports.runJob = void 0;
/* eslint-disable no-console */
const node_cron_1 = __importDefault(require("node-cron"));
const env_config_1 = require("../config/env-config.js");
const refund_1 = require("../helpers/refund.js");
const checkout_1 = require("../helpers/checkout.js");
const stripeConfigured = () => Boolean(env_config_1.envConfig.stripe_secret_key);
const JOBS = [
    {
        name: "process-pending-refunds",
        schedule: "*/10 * * * *",
        why: "A FAILED refund is a buyer who has not been paid back, so retry " +
            "promptly — but not so fast that a persistently failing refund " +
            "hammers Stripe.",
        run: () => (0, refund_1.processPendingRefunds)(),
        enabled: stripeConfigured,
    },
    {
        name: "reconcile-processing-refunds",
        schedule: "*/30 * * * *",
        why: "Only needed when a `refund.updated` webhook was missed. Read-only " +
            "against Stripe, so a slow cadence costs nothing but a little delay.",
        run: () => (0, refund_1.reconcileProcessingRefunds)(),
        enabled: stripeConfigured,
    },
    {
        name: "expire-stale-checkout-sessions",
        schedule: "0 * * * *",
        why: "Purely housekeeping — `consumeCheckoutSession` already refuses " +
            "anything not PENDING, so a stale draft is harmless until swept.",
        run: () => (0, checkout_1.expireStaleCheckoutSessions)(),
        enabled: () => true,
    },
];
const running = new Set();
let tasks = [];
/**
 * Run one job with the overlap guard and error containment applied.
 * Exported so a job can also be triggered by hand (an admin route, a script)
 * and still get the same protections.
 */
const runJob = async (job) => {
    if (running.has(job.name)) {
        console.warn(`[scheduler] ${job.name} is still running from the last tick — skipping`);
        return;
    }
    running.add(job.name);
    const startedAt = Date.now();
    try {
        const result = await job.run();
        const ms = Date.now() - startedAt;
        console.log(`[scheduler] ${job.name} ok in ${ms}ms`, result && typeof result === "object" ? result : "");
    }
    catch (error) {
        // Never rethrow: an unhandled rejection here would take down the server.
        console.error(`[scheduler] ${job.name} failed:`, error instanceof Error ? (error.stack ?? error.message) : error);
    }
    finally {
        running.delete(job.name);
    }
};
exports.runJob = runJob;
/** Starts every enabled job. Safe to call once, at boot. */
const startScheduler = () => {
    if (!env_config_1.envConfig.scheduler_enabled) {
        console.log("[scheduler] disabled (SCHEDULER_ENABLED=false)");
        return;
    }
    if (tasks.length > 0) {
        console.warn("[scheduler] already started — ignoring");
        return;
    }
    for (const job of JOBS) {
        if (!job.enabled()) {
            console.log(`[scheduler] ${job.name} skipped (prerequisites not configured)`);
            continue;
        }
        if (!node_cron_1.default.validate(job.schedule)) {
            console.error(`[scheduler] ${job.name} has an invalid schedule "${job.schedule}" — not started`);
            continue;
        }
        tasks.push(node_cron_1.default.schedule(job.schedule, () => void (0, exports.runJob)(job)));
        console.log(`[scheduler] ${job.name} scheduled (${job.schedule})`);
    }
};
exports.startScheduler = startScheduler;
/**
 * Stops every job. Call from a shutdown handler so a sweep is not killed
 * mid-flight (see docs/FEATURE-GAPS.md BE-18).
 */
const stopScheduler = async () => {
    await Promise.all(tasks.map((task) => task.stop()));
    tasks = [];
};
exports.stopScheduler = stopScheduler;
/** Exposed for tests and manual runs. */
exports.scheduledJobs = JOBS;
