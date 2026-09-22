import { PrismaClient } from "@/lib/prisma-client";
import { envConfig } from "./env-config";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

// Reuse one client across hot reloads in development; ts-node-dev re-executes
// this module on every change and each `new PrismaClient()` opens its own pool.
// Reads `envConfig`, not `process.env` — see CLAUDE.md § Config.
if (envConfig.node_env !== "production") globalForPrisma.prisma = prisma;
