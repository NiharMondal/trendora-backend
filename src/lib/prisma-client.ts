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
 *     import { Prisma, Product, OrderStatus, Role } from "@/lib/prisma-client";
 *
 * The shared client *instance* still lives in `src/config/db.ts` — never
 * instantiate `PrismaClient` directly.
 */
export * from "../../generated/prisma";
