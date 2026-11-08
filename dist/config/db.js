"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const prisma_client_1 = require("../lib/prisma-client.js");
const env_config_1 = require("./env-config");
const globalForPrisma = globalThis;
exports.prisma = globalForPrisma.prisma || new prisma_client_1.PrismaClient();
// Reuse one client across hot reloads in development; ts-node-dev re-executes
// this module on every change and each `new PrismaClient()` opens its own pool.
// Reads `envConfig`, not `process.env` — see CLAUDE.md § Config.
if (env_config_1.envConfig.node_env !== "production")
    globalForPrisma.prisma = exports.prisma;
