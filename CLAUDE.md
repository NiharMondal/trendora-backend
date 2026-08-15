# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Trendora backend — an e-commerce REST API built with Express 5, TypeScript, and Prisma (PostgreSQL). Package manager is **pnpm**.

## Commands

```bash
pnpm dev                 # Run dev server with hot reload (ts-node-dev) on src/server.ts
pnpm build               # Compile TypeScript to dist/ (tsc)
pnpm start               # Run compiled server (node dist/server.js)
pnpm lint                # ESLint over ./src
pnpm lint:fix            # ESLint autofix
pnpm prisma:generate     # Regenerate Prisma client (also runs on postinstall)
pnpm prisma:migrate      # prisma migrate dev
pnpm studio              # Open Prisma Studio
```

There is **no test runner configured** in this repo.

After changing `prisma/schema.prisma`, always run `pnpm prisma:generate` — the client is consumed from a non-standard path (see below) and stale generation causes type errors.

## Prisma client location (important)

The Prisma client is generated to **`generated/prisma`** (repo root, gitignored), not `node_modules/@prisma/client`. Import model types and enums from the relative path:

```ts
import { Prisma, Product, OrderStatus, Role } from "../../generated/prisma";
```

Note the codebase is inconsistent here: `src/helpers/order.ts` imports `Prisma` from `@prisma/client` while importing enums from `../../generated/prisma`. Prefer the `generated/prisma` path for new code. The shared client singleton is `src/config/db.ts` (`export const prisma`) — always import from there, never instantiate `PrismaClient` directly.

## Architecture

### Request flow

`src/server.ts` → `src/app.ts` → `src/routes/rootRouter.ts` (mounted at `/api/v1`) → per-module router.

All feature routers are registered in **`src/routes/routes-array.ts`** as `{ path, element }` entries. To add a module, create it under `src/modules/<name>/` and add one line to this array. Multiple routers can share a base path (e.g. `/products` is served by `productRouter`, `variantRouter`, and `productImageRouter`).

Middleware ordering in `app.ts` matters: the **Stripe webhook is mounted at `/webhook` before `express.json()`** so it receives the raw body (`express.raw`). Everything else parses JSON. `notFoundRoute` and `globalErrorHandler` are last.

### Module structure

Every feature under `src/modules/<name>/` follows the same four-file layered pattern:

- **`*.route.ts`** — Express router; wires `validateRequest(schema)` and `authGuard(...roles)` middleware, exports `<name>Router`.
- **`*.controller.ts`** — thin handlers wrapped in `asyncHandler`; extract from `req`, call the service, respond via `sendResponse`. Exported as a `<name>Controllers` object.
- **`*.service.ts`** — all business logic and Prisma access. Exported as a `<name>Services` object.
- **`*.validation.ts`** — Zod schemas; validation types are inferred and exported (e.g. `TRegisterUser`).

Keep DB/business logic in services, not controllers.

### Shared infrastructure

- **`src/utils/asyncHandler.ts`** — wraps async handlers so thrown errors reach the global error handler. Wrap every controller with it.
- **`src/utils/sendResponse.ts`** — standard success envelope. All successful responses are `{ success, message, meta?, result }` — note the data field is `result`, not `data`.
- **`src/utils/customError.ts`** — `throw new CustomError(statusCode, message)` for domain errors.
- **`src/middleware/globalErrorHandler.ts`** — central error formatter. Special-cases `ZodError` (400 validation), and Prisma `PrismaClientValidationError` / `PrismaClientKnownRequestError` (`P2002` duplicate, `P2025` not found). Error responses are `{ success: false, message, errorDetails }`.
- **`src/middleware/validateRequest.ts`** — `validateRequest(zodSchema)`; validates and replaces `req.body` with parsed data.
- **`src/middleware/authGuard.ts`** — `authGuard(...roles)`; verifies the JWT, loads the user, and enforces roles. **The access token is read directly from the `Authorization` header with no `Bearer ` prefix.** `req.user` is the decoded JWT payload (typed globally in `index.d.ts`).
- **`src/lib/PrismaQueryBuilder.ts`** — fluent builder for list endpoints (search / filter / paginate / sort / include). Standard usage in a service:

  ```ts
  const builder = new PrismaQueryBuilder<Prisma.ProductWhereInput>(query)
      .withDefaultFilter({ isDeleted: false })
      .search(["name", "description"])
      .filter().paginate().sort()
      .include({ images: true });
  const [data, meta] = await Promise.all([
      prisma.product.findMany(builder.build()),
      builder.getMeta(prisma.product),
  ]);
  return { meta, data };
  ```

  Reserved query params: `search`, `page`, `limit`, `sortBy`/`sort`, `orderBy`/`order`. Any other query key becomes a filter (comma-separated → `in`, `true`/`false` → boolean, numeric strings → number). Sort format is `?sortBy=field:asc`.

### Auth & tokens

- `src/helpers/jwt.ts` — access token expires in **20m**, refresh token in **30d**.
- User identity is split across two models: **`User`** (profile) and **`Auth`** (email/password/role, one-to-one). OAuth accounts link via `OAuthAccount`. Social users have `Auth.password = null`.
- JWT payload shape is `{ id: userId, role, email }`.

### Domain: orders & payments

- **`src/helpers/order.ts`** is the source of truth for order pricing. `validateAndCalculateOrder` fetches real prices from the DB — **never trust client-supplied prices**. Tax/shipping come from env (`TAX_RATE`, `SHIPPING_COST`, `FREE_SHIPPING_THRESHOLD`) via `envConfig`. It also generates order numbers (`ORD-YYYYMM-XXXXXX`) and logs status changes.
- **`src/helpers/allowedTransition.ts`** — `ensureTransitionAllowed(current, next)` enforces the order-status state machine (PENDING→PROCESSING→SHIPPED→DELIVERED, any non-terminal→CANCELED).
- Prices are Prisma `Decimal`; convert with `parseFloat(x.toString())` before arithmetic (existing pattern).
- Payments support Stripe (webhook-driven) and cash on delivery. Enums live in both `prisma/schema.prisma` and as Zod enums in `src/helpers/enum.ts` — keep them in sync.

### Config

All environment access goes through **`src/config/env-config.ts`** (`envConfig` object). Add new env vars there rather than reading `process.env` directly. See `.env.example` for required keys (DB, JWT secrets, Cloudinary, Stripe, SSLCommerz, email).

## Conventions

- Soft deletes: most models have `isDeleted`; delete operations set `isDeleted: true` and list queries filter it out via `withDefaultFilter({ isDeleted: false })`.
- Slugs are generated with `src/helpers/slug.ts` (`generateSlug`) on create/update for `Product` and `Category`.
- Cloudinary uploads use a `/temp/` staging folder; `moveFromTemp` promotes images to their final folder on save, and `deleteFromCloudinary` cleans up removed images (see `src/modules/product/product.service.ts` and `src/utils/cloudinary.ts`).
- ESLint uses `typescript-eslint` strict + stylistic; `no-console` is a warning (server bootstrap logs are `eslint-disable`d).
