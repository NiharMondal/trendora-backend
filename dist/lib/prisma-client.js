"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * The single re-export of the generated Prisma client.
 *
 * The client is generated to `generated/prisma` at the repo root (see
 * CLAUDE.md), which is **outside `src/`**. That matters for path aliases: an
 * alias pointing outside the compiled tree cannot be rewritten by `tsc-alias`,
 * so `import { Role } from "@prisma-client"` type-checks and then fails at
 * runtime with `Cannot find module`.
 *
 * Re-exporting through a file that *is* inside `src/` fixes that — `@/lib/prisma-client`
 * resolves like any other source file, and this is the one place that keeps the
 * relative path. Import model types, enums and the `Prisma` namespace from here:
 *
 *     import { Prisma, Product, OrderStatus, Role } from "./prisma-client.js";
 *
 * The shared client *instance* still lives in `src/config/db.ts` — never
 * instantiate `PrismaClient` directly.
 */
__exportStar(require("../../generated/prisma"), exports);
