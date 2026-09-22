"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const prisma_client_1 = require("../lib/prisma-client.js");
const globalForPrisma = globalThis;
exports.prisma = globalForPrisma.prisma || new prisma_client_1.PrismaClient();
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = exports.prisma;
