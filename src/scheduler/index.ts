/* eslint-disable no-console */
import cron, { type ScheduledTask } from "node-cron";
import { envConfig } from "@/config/env-config";
import {
	processPendingRefunds,
	reconcileProcessingRefunds,
} from "@/helpers/refund";
import { expireStaleCheckoutSessions } from "@/helpers/checkout";

/**
 * Background sweeps.
 *
 * Everything here is **idempotent and safe to run on a timer** — that is the
 * entry requirement for this file. A job must be safe to run twice, safe to run
 * concurrently with a request doing the same work, and safe to miss a tick.
 *
 * Three rules hold the whole thing up:
 *
 * 1. **A job never overlaps itself.** `running` is checked before each tick, so
 *    a sweep that takes longer than its interval is skipped rather than
 *    re-entered. Two copies of `processPendingRefunds` racing would attempt the
 *    same refund twice.
 * 2. **A job never crashes the process.** Every run is wrapped; a throw is
 *    logged and the schedule continues. An unhandled rejection in a timer
 *    callback takes the server down with it.
 * 3. **It runs in-process, so it is per-instance.** With more than one instance
 *    deployed, every instance runs every sweep. The jobs tolerate that — the
 *    gateway calls are idempotency-keyed and the sweeps are `updateMany` —
 *    but it is wasted work, so set `SCHEDULER_ENABLED=false` on all but one,
 *    or move to a shared queue.
 */

type Job = {
	name: string;
	/** Standard 5-field cron expression. */
	schedule: string;
	/** Why this cadence, for whoever changes it later. */
	why: string;
	run: () => Promise<unknown>;
	/** Skipped when false — e.g. a Stripe job with no Stripe key configured. */
	enabled: () => boolean;
};

const stripeConfigured = () => Boolean(envConfig.stripe_secret_key);

const JOBS: Job[] = [
	{
		name: "process-pending-refunds",
		schedule: "*/10 * * * *",
		why:
			"A FAILED refund is a buyer who has not been paid back, so retry " +
			"promptly — but not so fast that a persistently failing refund " +
			"hammers Stripe.",
		run: () => processPendingRefunds(),
		enabled: stripeConfigured,
	},
	{
		name: "reconcile-processing-refunds",
		schedule: "*/30 * * * *",
		why:
			"Only needed when a `refund.updated` webhook was missed. Read-only " +
			"against Stripe, so a slow cadence costs nothing but a little delay.",
		run: () => reconcileProcessingRefunds(),
		enabled: stripeConfigured,
	},
	{
		name: "expire-stale-checkout-sessions",
		schedule: "0 * * * *",
		why:
			"Purely housekeeping — `consumeCheckoutSession` already refuses " +
			"anything not PENDING, so a stale draft is harmless until swept.",
		run: () => expireStaleCheckoutSessions(),
		enabled: () => true,
	},
];

const running = new Set<string>();
let tasks: ScheduledTask[] = [];

/**
 * Run one job with the overlap guard and error containment applied.
 * Exported so a job can also be triggered by hand (an admin route, a script)
 * and still get the same protections.
 */
export const runJob = async (job: Job): Promise<void> => {
	if (running.has(job.name)) {
		console.warn(
			`[scheduler] ${job.name} is still running from the last tick — skipping`,
		);
		return;
	}

	running.add(job.name);
	const startedAt = Date.now();

	try {
		const result = await job.run();
		const ms = Date.now() - startedAt;
		console.log(
			`[scheduler] ${job.name} ok in ${ms}ms`,
			result && typeof result === "object" ? result : "",
		);
	} catch (error) {
		// Never rethrow: an unhandled rejection here would take down the server.
		console.error(
			`[scheduler] ${job.name} failed:`,
			error instanceof Error ? (error.stack ?? error.message) : error,
		);
	} finally {
		running.delete(job.name);
	}
};

/** Starts every enabled job. Safe to call once, at boot. */
export const startScheduler = (): void => {
	if (!envConfig.scheduler_enabled) {
		console.log("[scheduler] disabled (SCHEDULER_ENABLED=false)");
		return;
	}

	if (tasks.length > 0) {
		console.warn("[scheduler] already started — ignoring");
		return;
	}

	for (const job of JOBS) {
		if (!job.enabled()) {
			console.log(
				`[scheduler] ${job.name} skipped (prerequisites not configured)`,
			);
			continue;
		}

		if (!cron.validate(job.schedule)) {
			console.error(
				`[scheduler] ${job.name} has an invalid schedule "${job.schedule}" — not started`,
			);
			continue;
		}

		tasks.push(cron.schedule(job.schedule, () => void runJob(job)));
		console.log(`[scheduler] ${job.name} scheduled (${job.schedule})`);
	}
};

/**
 * Stops every job. Call from a shutdown handler so a sweep is not killed
 * mid-flight (see docs/FEATURE-GAPS.md BE-18).
 */
export const stopScheduler = async (): Promise<void> => {
	await Promise.all(tasks.map((task) => task.stop()));
	tasks = [];
};

/** Exposed for tests and manual runs. */
export const scheduledJobs = JOBS;
