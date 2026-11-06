/* eslint-disable no-console */
import type { Server } from "http";
import app from "./app";
import { prisma } from "./config/db";
import { envConfig, warnAboutDisabledFeatures } from "./config/env-config";
import { startScheduler, stopScheduler } from "./scheduler";

/**
 * How long to let in-flight requests finish before forcing the process down.
 * Kept under the 30s most orchestrators allow before sending SIGKILL, so the
 * shutdown we control runs instead of the one we do not.
 */
const SHUTDOWN_GRACE_MS = 10_000;

let server: Server | undefined;
let shuttingDown = false;

const shutdown = async (signal: string, exitCode = 0): Promise<void> => {
	// A second Ctrl-C (or SIGTERM after SIGINT) must not start a second
	// shutdown on top of the first.
	if (shuttingDown) return;
	shuttingDown = true;

	console.log(`\n[shutdown] ${signal} received, draining…`);

	// Force-exit if draining stalls — a hung keep-alive socket must not hold
	// the process open past the orchestrator's patience.
	const forceTimer = setTimeout(() => {
		console.error(
			`[shutdown] still draining after ${SHUTDOWN_GRACE_MS}ms — forcing exit`,
		);
		process.exit(1);
	}, SHUTDOWN_GRACE_MS);
	forceTimer.unref();

	try {
		// 1. Stop timers first, so no sweep starts while we are closing.
		await stopScheduler();

		// 2. Stop accepting new connections and let in-flight requests finish.
		//    Killing them mid-request can abort a transaction between the
		//    order write and the refund intent.
		if (server) {
			await new Promise<void>((resolve) => {
				server?.close(() => resolve());
			});
			console.log("[shutdown] http server closed");
		}

		// 3. Only now let go of the database.
		await prisma.$disconnect();
		console.log("[shutdown] database disconnected");
	} catch (error) {
		console.error("[shutdown] error while shutting down:", error);
		exitCode = 1;
	} finally {
		clearTimeout(forceTimer);
		process.exit(exitCode);
	}
};

async function main() {
	// Prove the database is reachable before opening the port. The old code
	// logged "Database connected" unconditionally, having never connected —
	// so a down database looked like a healthy boot.
	try {
		await prisma.$connect();
		console.log("Database connected");
	} catch (error) {
		console.error(
			"Failed to connect to the database:",
			error instanceof Error ? error.message : error,
		);
		process.exit(1);
	}

	warnAboutDisabledFeatures();

	server = app.listen(envConfig.port, () => {
		console.log("Server is running on port " + envConfig.port);

		// After the port is open, so a slow first sweep cannot delay the listen
		// and fail a container health check.
		startScheduler();
	});
}

// SIGTERM is what orchestrators send; SIGINT is Ctrl-C.
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

/**
 * The process is in an unknown state after either of these, so the only safe
 * move is to log loudly and go down — a supervisor restarts us clean. Staying
 * up risks serving requests from corrupted state.
 */
process.on("unhandledRejection", (reason) => {
	console.error("[fatal] unhandled promise rejection:", reason);
	void shutdown("unhandledRejection", 1);
});

process.on("uncaughtException", (error) => {
	console.error("[fatal] uncaught exception:", error);
	void shutdown("uncaughtException", 1);
});

void main();
