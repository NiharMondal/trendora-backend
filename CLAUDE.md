# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Trendora backend — a **multi-vendor** e-commerce REST API built with Express 5, TypeScript, and Prisma (PostgreSQL). Package manager is **pnpm**.

Many sellers list products; buyers check out once across several stores; the platform takes a commission and settles the rest to each vendor. See **The marketplace model** below — it is the part of this codebase least guessable from the file tree.

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

## Path aliases

`src/` is aliased to **`@/`**. Use it for anything outside the current directory; keep
same-directory imports as `./relative`.

```ts
import { prisma } from "@/config/db";
import { authGuard } from "@/middleware/authGuard";
import { Role } from "@/lib/prisma-client";
import { authControllers } from "./auth.controller";   // same dir — stays relative
```

**Aliases are compile-time only, and three things keep them working at runtime.** Breaking any one
of them produces `Cannot find module "@/..."` at boot, not a type error:

| | |
| --- | --- |
| `tsconfig.json` | `baseUrl` + `paths` — type checking only |
| `pnpm dev` | `ts-node-dev -r tsconfig-paths/register` |
| `pnpm build` | `tsc && tsc-alias` — `tsc-alias` rewrites `dist/` back to relative paths |
| `pnpm seed` | `tsx` resolves `paths` natively, nothing to add |

## Prisma client location (important)

The Prisma client is generated to **`generated/prisma`** (repo root, gitignored), not
`node_modules/@prisma/client`. Because that is **outside `src/`**, it cannot be aliased directly —
`tsc-alias` can only rewrite paths that land inside the compiled tree, so an alias pointing at it
type-checks and then fails at runtime.

`src/lib/prisma-client.ts` re-exports it, and that file holds the only relative path to it. Import
model types, enums and the `Prisma` namespace from the alias:

```ts
import { Prisma, Product, OrderStatus, Role } from "@/lib/prisma-client";
```

The shared client *instance* is `src/config/db.ts` (`export const prisma`) — always import from
there, never instantiate `PrismaClient` directly.

## Architecture

### Request flow

`src/server.ts` → `src/app.ts` → `src/routes/rootRouter.ts` (mounted at `/api/v1`) → per-module router.

All feature routers are registered in **`src/routes/routes-array.ts`** as `{ path, element }` entries. To add a module, create it under `src/modules/<name>/` and add one line to this array. Multiple routers can share a base path (e.g. `/products` is served by `productRouter`, `variantRouter`, and `productImageRouter`).

**Middleware ordering in `app.ts` is load-bearing.** In order: `trust proxy` → `helmet` → `cors` →
`morgan` → `/webhook` → `express.json({ limit })` → `apiLimiter` + `/api/v1` → `notFoundRoute` →
`globalErrorHandler`. Three of those positions are deliberate:

- The **Stripe webhook is mounted at `/webhook` before `express.json()`** so it receives the raw
  body (`express.raw`). It is also above `apiLimiter` and outside `/api/v1`, so **Stripe's retries
  are never throttled** — a dropped retry loses an order or leaves a refund unreconciled.
- **`cors` must precede the rate limiter.** A 429 is still a cross-origin response; without CORS
  headers already attached the browser reports an opaque CORS failure instead of the real message.
- **`morgan` sits above the webhook and the limiter**, so both appear in the log.

Rate limiters are in `src/middleware/rateLimiter.ts` and are applied **per endpoint** in
`auth.route.ts`, never to the whole router: `/refresh-token` fires for every signed-in browser every
~20 minutes, so throttling it at credential-guessing rates would break sessions for everyone behind
one NAT. `loginLimiter` uses `skipSuccessfulRequests` so only *failed* logins count.

The webhook router serves **both `POST /webhook` and `POST /webhook/stripe`**. It is deliberately NOT in `routes-array.ts`: registering it under `/api/v1` would expose a second path whose body `express.json()` has already consumed, so every signature check on it would fail. (That duplicate existed at `/api/v1/payments/stripe` and has been removed.)

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
- **`src/middleware/authGuard.ts`** — `authGuard(...roles)`; verifies the JWT, loads the user, and enforces roles. **The access token is read directly from the `Authorization` header with no `Bearer ` prefix.** `req.user` is the decoded JWT payload **with `role` overwritten by the database value** (typed globally in `index.d.ts`).
  **Authorization reads `Auth.role` from the database, never the token's `role` claim.** The claim is a 20-minute-old snapshot, and `req.user.role` flows into `resolveVendorScope` / `vendorListScope`, where ADMIN means "may act on any store" — so trusting a stale claim is a write-scope escalation, not a routing detail. It also means a newly approved vendor reaches their dashboard immediately instead of waiting for a token refresh. The row is loaded anyway; do not change this back.
- **`src/lib/PrismaQueryBuilder.ts`** — fluent builder for list endpoints (search / filter / paginate / sort / include). Standard usage in a service:

  ```ts
  const builder = new PrismaQueryBuilder<Prisma.ProductWhereInput>(query, {
      model: "Product",          // REQUIRED — see below
  })
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

  **`model` is required.** `sortBy` comes from the query string and is written straight into
  Prisma's `orderBy`, so the builder needs to know the model to validate it — and it cannot infer
  one, because the generic is erased at runtime. It reads the model's scalar and enum fields from
  `Prisma.dmmf` (derived, so it never goes stale as columns are added) and **400s on anything
  else**, naming the valid fields. Pass `allowedFields` only to narrow further than the schema.

  **Reaching one level into a to-one relation** — for a model whose API shape is flatter than its
  schema, like `User`/`Auth`:

  ```ts
  new PrismaQueryBuilder<Prisma.UserWhereInput>(query, {
      model: "User",
      sortAliases: { email: "auth.email", role: "auth.role" },  // ?sortBy=email:asc
  }).search(["name", "phone"], ["auth.email"])                  // ?search= also matches email
  ```

  Both take `"relation.column"` and expand to `{ auth: { is: { email: … } } }` /
  `orderBy: { auth: { email: "asc" } }`. `relationPaths` is a **second parameter** to `search()`
  so the first keeps its `keyof TWhereInput` typing. `sortAliases` are declared in code, never
  read from the query string — they widen what is *sortable*, not what a caller can *inject*.

### Auth & tokens

- `src/helpers/jwt.ts` — access token expires in **20m**, refresh token in **30d**.
- User identity is split across two models: **`User`** (profile) and **`Auth`** (email/password/role, one-to-one). OAuth accounts link via `OAuthAccount`. Social users have `Auth.password = null`.
- **That split is storage, not API shape.** `GET /users` returns `email` and `role` **flattened
  onto the user**, not nested under `auth` — they are attributes of the person, and no client
  needs to know they live one table over. `flattenAuth` in `user.service.ts` destructures `auth`
  away and re-adds exactly two named fields, which is also what keeps `password` from ever
  appearing if someone later relaxes a `select`. Both are `null` for a user with no `Auth` row.
- JWT payload shape is `{ id: userId, role, email }`.

### Password reset is a two-step, email-only flow

`POST /auth/forgot-password { email }` → `POST /auth/reset-password { token, newPassword }`, both
public. The rules that hold it together, none of which are optional:

- **The token never appears in a response.** It exists in exactly two places: the emailed URL
  (`${FRONTEND_URL}/reset-password?token=<raw>`) and, as a **SHA-256 hash**, in
  `PasswordResetToken.tokenHash`. SHA-256 rather than bcrypt because the token is 32 bytes of
  CSPRNG output with no guessable structure, and the lookup must be one indexed read.
- **`forgot-password` answers identically for every input.** Unknown address, deleted user,
  social-only account, or a repeat inside `PASSWORD_RESET_COOLDOWN_SECONDS` — all return the same
  generic 200. Every early return in that service is silent on purpose; adding a distinguishing
  error turns it back into an account-enumeration oracle, which is what it used to be.
- **Mail failures must not surface.** `sendEmailSafely` swallows them into a log, because mail is
  attempted only for addresses that exist — letting an SMTP error reach the client would leak
  exactly what the generic response hides.
- **Issuing a token retires every outstanding one**, and redeeming one retires the rest, so only
  the newest link can ever work and it works once.
- `reset-password` returns **no tokens**. The user logs in afterwards.

### Sending email

**`src/utils/sendEmail.ts` is the only place a mail transport is built.** It exports
`sendEmail` (throws), `sendEmailSafely` (logs and returns `false`) and `isEmailConfigured`.
Bodies live in `src/utils/email-templates.ts` — one exported function per message returning
`{ subject, html, text }`, so no caller can forget the plain-text fallback or invent a subject.

Requires `EMAIL` / `PASSWORD` (a Gmail *app password*); with them unset, mail is skipped and
logged rather than throwing.

**`src/helpers/notifications.ts` decides who gets told what.** Services call one function with an
id (`notifyOrderPlaced(orderId)`, `notifyVendorOrderStatusChanged(vendorOrderId)`, …) and that
module does the reading, picks the template and sends. Adding a notification is a template plus one
entry there — not a new `include` tree in a service.

Two rules, both absolute:

1. **Never throw.** Everything is wrapped in `notify()`, which turns failures into a log line. An
   order that is already committed is not un-placed because a confirmation email bounced.
2. **Never call from inside a `$transaction`.** These read from the database and talk to SMTP;
   doing that inside a transaction holds it open across network round trips. Every hook point is
   *after* the commit — the same reasoning that keeps the gateway call outside the refund
   transaction.

Wired today: order placed (buyer + each seller, their own parcel only), parcel SHIPPED / DELIVERED
/ CANCELED, refund SUCCEEDED, store approved / rejected, payout paid. `PROCESSING` deliberately
sends nothing, and a cancellation only promises a refund when a `Refund` row actually exists.

## The marketplace model

### Three actors, one role enum

`Role` is `CUSTOMER | VENDOR | ADMIN`. A user becomes a seller by owning a
`Vendor` (`Vendor.ownerId` is unique — **one store per account**); an admin
approving that store is what flips the role to `VENDOR`.

**A VENDOR is still a shopper.** Every buyer-facing route therefore guards with
all three roles (`authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN)`), not just
`CUSTOMER` — writing `authGuard(Role.CUSTOMER)` on a cart/address/order/review
route silently locks sellers out of their own checkout.

### `authGuard` checks role, never ownership

`authGuard` cannot answer "does this row belong to the caller?", so every
vendor-scoped read and write goes through **`src/helpers/vendor.ts`**:

| helper | use |
| --- | --- |
| `requireApprovedVendor(userId)` | the caller's store, or a 403 naming the actual state (pending/rejected/suspended) |
| `resolveVendorScope(user, targetVendorId?)` | which store a write applies to — an ADMIN must name one, a VENDOR always gets their own and any id they send is ignored |
| `vendorListScope(user, requestedVendorId?)` | pins a list query to the caller's store |
| `assertVendorOwnsProduct` / `assertVendorOwnsVendorOrder` | row ownership; **404, not 403**, so another store's ids stay unguessable |
| `publicProductFilter(extra?)` | the storefront visibility filter |

Adding a vendor-scoped endpoint without one of these is the main way to leak
one store's data into another's dashboard.

**The same rule applies to any user-owned row, not just vendor-scoped ones.** A route guarded with
`authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN)` is guarded against *strangers*, not against
*other customers* — if the handler then looks a row up by `req.params.id` alone, every signed-in
account can reach every other account's data. `src/modules/address/address.service.ts`
(`findOwnedAddress`) and `src/modules/wishlist/wishlist.service.ts` (`findOwnedWishlist`) are the
reference implementations for a per-user resource: filter on `id + userId`, throw **404 rather than
403**, and have the controller pass `req.user.id`. Never take the owner from the request body —
`wishlist.validation.ts` carries the note on why that schema deliberately omits `userId`.

**Soft-delete user-owned rows that an order can reference.** `Address` is the worked example:
`Order.shippingAddressId` is a required column pointing at it, so a hard delete breaks past orders.
Orders carry their own `shippingSnapshot` (written by `persistOrder`) precisely so the live row can
be hidden without rewriting history.

### Product visibility has three independent gates

A product is public only when **all three** hold, which is exactly what
`publicProductFilter` encodes — always compose from it rather than hand-rolling
the conditions:

1. `status === APPROVED` — admin moderation (`DRAFT → PENDING → APPROVED/REJECTED`)
2. `isPublished === true` — the vendor's own show/hide switch
3. the owning `Vendor.status === APPROVED` — a suspended store's catalogue disappears at once

Editing a *material* field (name, description, category, brand, gender, images)
on an approved listing sends it back to `PENDING`; price and stock edits do not
(see `MATERIAL_FIELDS` in `product.service.ts`). Moderation state is never
accepted from the request body.

`Product.name` is unique **per vendor** (`@@unique([vendorId, name])`) — two
stores may both sell "Nike Air Max 90". `slug` stays globally unique and
`generateUniqueProductSlug` appends the store slug on collision.

### Variants and images are editable as sub-resources

`PATCH /products/:id` takes the **whole** `variants` and `images` arrays and
deletes any row whose `id` the client did not round-trip — for an image, that
destroys the Cloudinary asset too. Prefer the per-row endpoints under
`/products/:productId`, which cannot touch a row the request did not name:

```
GET|POST /variants        PATCH|DELETE /variants/:variantId
GET|POST /images          PATCH|DELETE /images/:imageId
```

Both modules share `src/helpers/product.ts`, and anything added there must keep
these rules:

- **The GETs are public and gated by `resolveViewableProduct`**, which composes
  `publicProductFilter`. They 404 on a draft for the same reason
  `GET /products/:id` does; a vendor reads their own unpublished listing through
  `/products/vendor/my-products/:id`, which returns both collections nested.
  Writes go through `resolveEditableProduct` — 404, never 403.
- **Variants are SOFT deleted.** `OrderItem.variantId` is `ON DELETE SET NULL`,
  so a hard delete detaches every past order line from the variant it sold.
  Every read filters through the shared `liveVariants`; forgetting it makes
  deleted variants reappear on the storefront. Images have no such reference and
  are hard deleted, because the Cloudinary asset goes with them.
- **Imagery is material, variants are not.** Adding or removing an image
  re-opens moderation on an APPROVED listing
  (`reopenModerationIfApproved`) and the response says so; changing stock, price
  or which image is the hero does not. This mirrors `MATERIAL_FIELDS` — keep the
  two in step.
- Exactly one image is `isMain`, enforced in-transaction because the column is a
  plain boolean; the last image cannot be deleted; a variant's (size, colour)
  pair is unique per product, enforced in code because the DB does not.

### Orders split across two levels

| model | role |
| --- | --- |
| `Order` | the buyer-facing container: one checkout, one payment, one shipping address. Money fields are the **sum** of its slices. |
| `VendorOrder` | one vendor's slice — the unit of **fulfilment and payout**. Its `orderStatus` is authoritative. |
| `OrderItem` | belongs to a `VendorOrder`; carries a denormalised `vendorId`. |

**`Order.orderStatus` is derived, not authoritative.** Never write it directly:
call `recalculateOrderRollup(tx, orderId)` after any `VendorOrder` change. The
rules live in `deriveOrderStatus`. Fulfilment moves through
`PATCH /orders/vendor-orders/:vendorOrderId/status`; the old
`PATCH /orders/:orderId/status` is gone, because with several sellers there is
no single status to set.

`ensureTransitionAllowedForActor(current, next, capacity)` layers permissions on
the state machine, where **capacity is not role**: `resolveOrderActorCapacity`
decides whether the caller is the `admin`, the `seller` of that parcel, or its
`buyer`. A VENDOR is also a shopper, so the same account is a seller on its own
store's parcels and a buyer on parcels it ordered elsewhere — deciding from
`Role` alone is what used to lock sellers out of cancelling their own purchases.

- `seller` moves forward and may cancel while nothing has shipped; cancelling an
  already-shipped parcel is a refund dispute and stays ADMIN-only.
- `buyer` may do exactly one thing: **`PENDING -> CANCELED`**.

**Buyer cancellation is gated on `OrderStatus`, never `PaymentStatus`.** A COD
order stays `paymentStatus: PENDING` until every parcel is delivered (see
`reconcilePayment`), so gating on payment would let a buyer cancel a parcel that
had already shipped. Payment status decides whether a refund is owed
(`recordRefundIntent`), not whether cancelling is allowed.

### The money formulas (duplicated on the frontend — keep in sync)

Per vendor group, in `validateAndCalculateOrder` (`src/helpers/order.ts`):

```
subtotal     = sum(item.subtotal)           // priceAtPurchase x qty, discount already baked in
shippingCost = subtotal >= vendor.freeShippingThreshold ? 0 : vendor.shippingFee
tax          = round2(subtotal x TAX_RATE)
totalAmount  = subtotal + tax + shippingCost

commissionAmount = round2(subtotal x commissionRate)   // platform's cut
vendorEarning    = subtotal + shippingCost - commissionAmount
```

- **`discount` is informational.** `priceAtPurchase` is already the discounted
  price, so subtracting `discount` from a total double-counts it.
- Invariant, asserted by `assertCalculationBalances` and mirrored in the
  migration's backfill:
  `commissionAmount + vendorEarning == subtotal + shippingCost == totalAmount - tax`.
  Tax is the platform's to remit; **shipping belongs to the vendor who ships**.
- **Shipping is per vendor**, evaluated against each store's own threshold — a
  two-store cart pays two shipping fees.
- `VendorOrder.commissionRate` is a **snapshot**, so changing a store's rate
  never rewrites past orders.
- Money helpers live in `src/helpers/money.ts` (`round2`, `toNumber`,
  `sumMoney`). Round at the point each value is computed, never at the end.

### Checkout is webhook-first, via a server-side draft

`POST /orders` with `paymentMethod: "STRIPE"` writes **no order row**. It
persists the priced split as a `CheckoutSession` and returns
`{ paymentUrl, orderNumber, vendors, totalAmount }`; the order is created by
`POST /webhook` once the charge succeeds.

The draft exists because Stripe metadata (50 keys, 500 chars per value) cannot
carry a multi-vendor cart — only `checkoutSessionId` travels through Stripe.
It is also the idempotency key: `consumeCheckoutSession` flips it to
`COMPLETED` inside the same transaction that creates the order, so a replayed
webhook finds nothing to redeem and returns without duplicating.

> Historical note: the previous implementation read `items`/`subtotal`/`tax`
> from Stripe metadata that `createStripePaymentUrl` never set, so **no Stripe
> order was ever created**. Don't reintroduce cart-in-metadata.

`CASH_ON_DELIVERY` creates the order inline and returns `{ order, paymentUrl: null }`.

**`src/helpers/create-order.ts` (`persistOrder`) is the single place an Order is
written** — both payment branches call it, so the shape of a created order
cannot drift between them. It must run inside a `$transaction`; stock is
deducted with a conditional `updateMany` guarded on `stock >= quantity`, so a
concurrent order aborts rather than overselling.

### Payouts: platform collects, then settles

One charge lands in the platform's account; each vendor is owed their
`vendorEarning`. A `Payout` batches those into one transfer.

Eligibility is *delivered + buyer paid + `payoutId IS NULL`*. Attaching the
vendor orders happens in the same transaction that creates the payout, which is
what makes a run idempotent — an earning can only ever belong to one payout.
`markFailed` releases them back to the pool.

`reconcilePayment` keeps the single `Payment` row consistent with N
independently-cancellable slices: COD becomes `PAID` once every live slice is
delivered, and a fully-cancelled unpaid order becomes `FAILED`. It deliberately
does **not** touch refund state — see below.

### Refunds: a ledger, and a two-phase write

Cancelling a paid parcel issues a real Stripe refund. The shape of
`src/helpers/refund.ts` is driven by one rule: **never call a payment gateway
from inside a database transaction** — it holds the transaction open across a
network round trip, and a rollback after Stripe moved money would leave a
refund at the gateway with no record of it here. So:

1. `recordRefundIntent(tx, …)` writes a `PENDING` Refund row **inside** the
   transaction that cancels the parcel. Either both happen or neither does.
2. `processRefund(id)` runs **after the commit** and does the gateway call,
   then writes the outcome back.

If phase 2 never runs (crash, Stripe down) the row stays `PENDING` and
`processPendingRefunds()` picks it up. Nothing is lost and no money moves twice.

`Refund` is the mirror of `Payout` — a ledger with one row per money movement:

| | direction |
| --- | --- |
| `Payout` | platform → vendor |
| `Refund` | platform → buyer |

**Idempotency has two layers.** `Refund.vendorOrderId` is unique, so a replayed
cancel finds the existing row instead of refunding the same goods twice; and
`idempotencyKey` (`refund:<id>:<attempt>`) is sent to Stripe, so even a retried
HTTP call for one attempt cannot move money twice. A deliberate retry after a
`FAILED` attempt bumps `attempts` and derives a fresh key — that is what makes
it a new request rather than a replay.

**`Payment.refundAmount` means money that ACTUALLY went back** — the sum of
`SUCCEEDED` refunds — and is owned exclusively by `recomputePaymentRefundState`.
Nothing else may write it, or the ledger and the summary drift. What a buyer is
*owed* is never stored; `outstandingRefundForOrder()` derives it from the
cancelled parcels so it cannot go stale.

`PaymentStatus.PARTIALLY_REFUNDED` exists because refunding one parcel of three
is neither `PAID` (which hides it) nor `REFUNDED` (which overstates it).

Two things follow from "the cancellation must not be undone by a gateway
hiccup":

- The automatic path calls `processRefund` with `throwOnError: false`. A
  cancellation that has already committed must not be reported as failed just
  because Stripe was briefly unavailable; the failure lands on the Refund row
  and in the admin queue instead. An operator pressing **retry** does get the
  gateway error (`throwOnError: true`), because they need to see it.
- **A cancelled parcel whose refund is `FAILED` is a buyer who has not been
  paid back.** That gap is what `/refunds/admin/outstanding` exists to surface.

Cash on delivery has no gateway to call, so `recordRefundIntent` returns null
for it; money handed back in person is recorded with `recordManualRefund`
(`gateway` names the rail, e.g. `"cash"`, and there is no `gatewayRefundId`).

### Background sweeps

`src/scheduler/index.ts` runs three `node-cron` jobs, started from `server.ts` once the port is
open: `process-pending-refunds` (10 min), `reconcile-processing-refunds` (30 min) and
`expire-stale-checkout-sessions` (hourly).

**The entry requirement for anything added here is that it be idempotent** — safe to run twice,
safe to run alongside a request doing the same work, and safe to miss a tick. Three properties are
enforced by the runner and must stay: a job never overlaps itself, a job never crashes the process
(an unhandled rejection in a timer callback takes the server down), and the whole thing is
per-instance, so `SCHEDULER_ENABLED=false` on all but one instance when several are deployed.

`processPendingRefunds` retries PENDING and FAILED only. A `PROCESSING` refund is already in flight,
so re-sending it would be a second refund attempt — `reconcileProcessingRefunds` handles those
instead and is **read-only against Stripe**, settling the row from the gateway's view. Both it and
the webhook map Stripe statuses through the single `mapStripeRefundStatus`.

### Which webhook events must be enabled

`POST /webhook` handles nine event types, and the endpoint sending to it has to
have them switched on or orders and refunds silently stop reconciling:

| event | why |
| --- | --- |
| `checkout.session.completed` | **creates the order.** Without it no Stripe order exists at all |
| `checkout.session.expired` | marks an abandoned checkout draft EXPIRED |
| `payment_intent.succeeded` | backstop for the paid state |
| `payment_intent.payment_failed` | records the failure reason |
| `refund.created` / `refund.updated` / `refund.failed` | adopts and settles refunds, including ones raised in the **Stripe dashboard** |
| `charge.refund.updated` | the LEGACY name for `refund.updated`; an endpoint pinned to an older `api_version` emits only this one |
| `charge.refunded` | charge-level backstop, so a missed individual refund event still reconciles |

Without the refund events, `Payment.refundAmount` silently disagrees with Stripe.

**Local development:** `pnpm stripe:listen` forwards exactly this set to
`localhost:5001/webhook` (needs the Stripe CLI: `brew install stripe/stripe-cli/stripe && stripe login`).
It prints a `whsec_…` that must go in `STRIPE_WEBHOOK_SECRET` — that secret
belongs to the listen session and is not a registered endpoint's secret. The
script omits `charge.refund.updated` on purpose: `stripe listen` runs on the
account's current API version, which emits `refund.*`, and forwarding both
would deliver every refund change twice (harmless — the handler is idempotent —
but pointless).

### Other domain notes

- **`src/helpers/order.ts`** is still the source of truth for pricing.
  `validateAndCalculateOrder` fetches real prices from the DB — **never trust
  client-supplied prices** — and now also rejects items whose store is
  suspended, and merges duplicate cart lines so the same variant cannot pass
  the stock check twice.
- Order numbers are `ORD-YYYYMM-XXXXXX`; a vendor slice is `...-V01`. Generation
  checks both `Order` and `CheckoutSession`, since a draft claims a number
  before the order row exists.
- Prices are Prisma `Decimal`; convert with `toNumber()` from
  `src/helpers/money.ts` rather than `parseFloat(x.toString())` in new code.
- `VendorReview` rates a **store** (tied to a delivered vendor order, one per
  order); `Review` rates a **product**. Both maintain denormalised
  `averageRating` / `totalReviews` counters inside the write transaction.
- **`Payment` and `Refund` are narrowed by caller on order detail, and the
  `Payment` read endpoints are read-only.** `gatewayResponse` holds the entire
  Stripe session — including the buyer's name, email and billing address — so
  `sanitizePayment` / `sanitizeRefund` (`src/helpers/payment.ts`) give it to an
  **admin only**. A buyer sees their payment minus the blob; a **seller** sees
  `{ method, status, paidAt }` and refunds on their own parcels only, because one
  payment spans every store on the order. `GET /payments*` exists for reads
  (`/me`, `/order/:orderId`, `/admin/all`, `/:id`) and there is deliberately no
  write route — payment state is the gateway's, reconciled by the webhook and
  `reconcilePayment`. Note `payment.route.ts` exports **two** routers: only
  `paymentRouter` belongs in `routes-array.ts`; `stripeWebhookRouter` must stay
  at `/webhook` above `express.json()`.
- **`OrderStatusHistory` is returned on order detail, narrowed by caller.**
  `sanitizeStatusHistory` in `order.service.ts` gives buyers and sellers only the
  timeline (`oldStatus`, `newStatus`, `note`, `createdAt`); `ipAddress` and the
  acting user are **ADMIN only**. Both endpoints that return it are reachable by
  the buyer *and* by any vendor with a slice, so returning the raw row let a
  seller read the buyer's IP off their own parcel. Never widen that projection
  without re-checking who can reach the endpoint.
- Enums live in `prisma/schema.prisma`, as Zod mirrors in `src/helpers/enum.ts`,
  and as frontend constants — all three must stay in sync.

### Config

All environment access goes through **`src/config/env-config.ts`** (`envConfig` object) — and this
is now enforced rather than merely encouraged: `grep process.env src/` returns nothing outside that
file. Add new vars to its Zod schema, not to `process.env` reads.

**The schema is validated at import time and the process refuses to boot on a bad value**, listing
every problem at once. Three tiers:

- **Required** — `DATABASE_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`.
- **Optional with a default** — every number, range-checked. `TAX_RATE=abc` is a boot error, not a
  `NaN` that silently makes every order's tax `NaN`.
- **Feature-gated** — Stripe, Cloudinary, SMTP. The server boots without them and
  `warnAboutDisabledFeatures()` logs which features are off.

See `.env.example`, whose header repeats this contract.

### Boot and shutdown

`src/server.ts` connects to the database **before** opening the port, and only then logs
"Database connected" — that line used to print unconditionally, so a down database looked like a
healthy boot.

On SIGTERM/SIGINT it drains in order: **stop the scheduler → close the HTTP server and let
in-flight requests finish → `prisma.$disconnect()`**. Killing requests mid-flight can abort a
transaction between the order write and the refund intent. A 10s force-exit timer bounds it, and
`unhandledRejection`/`uncaughtException` log and exit 1.

Probes are at **`/health`** (liveness, touches nothing external) and **`/health/ready`** (readiness,
`SELECT 1`, returns 503 when the database is unreachable). They sit outside `/api/v1` and above the
rate limiter, and are skipped by the request log. **Do not point liveness at the database** — that
turns a brief DB blip into a restart loop across every instance.

## Conventions

- **The taxonomy is platform-owned.** `Category`, `SizeGroup`, `Size` and `Brand` are ADMIN-only writes — if vendors could create categories you would have forty spellings of "T-Shirts" within a month and the size-group logic would come apart.
- Soft deletes: most models have `isDeleted`; delete operations set `isDeleted: true` and list queries filter it out via `withDefaultFilter({ isDeleted: false })`.
- Slugs are generated with `src/helpers/slug.ts` on create/update. Use `generateUniqueProductSlug` / `generateUniqueVendorSlug` for products and stores (they resolve collisions); bare `generateSlug` is for `Category`, whose names are admin-controlled and already unique.
- Cloudinary uploads use a `/temp/` staging folder; `moveFromTemp` promotes images to their final folder on save, and `deleteFromCloudinary` cleans up removed images (see `src/modules/product/product.service.ts` and `src/utils/cloudinary.ts`).
- ESLint uses `typescript-eslint` strict + stylistic; `no-console` is a warning (server bootstrap logs are `eslint-disable`d). `pnpm lint` is currently
  **0 errors, 1 warning** — a stray `console.log` at `src/middleware/globalErrorHandler.ts:41`.

## Known gaps in the marketplace layer (verified, not yet fixed)

> The complete backend audit — including the P0 security items (`forgot-password` leaking a
> token, two IDORs, an unguarded Cloudinary delete) that are **not** listed here — is in
> `docs/FEATURE-GAPS.md`. Read it before starting work on auth, address or wishlist code.

- **This Stripe test account is shared with another project.** The only
  registered webhook endpoint is `edu-sphere-backend-pi.vercel.app/webhook`
  (api_version `2023-08-16`) — not Trendora's. There is no endpoint pointing at
  this backend, so a deployed Trendora needs one created with the nine events
  listed above. Local dev uses `pnpm stripe:listen` and needs none.
- ~~**Nothing schedules `processPendingRefunds()`.**~~ **Fixed** — see
  **Background sweeps** above and `docs/FEATURE-GAPS.md` BE-11.
- ~~**A `PROCESSING` refund is not polled.**~~ **Fixed** — `reconcileProcessingRefunds`
  now polls them on a 30-minute sweep.
- **No stock reservation.** Stock is deducted at order creation (COD) or at the
  webhook (Stripe); between starting a Stripe checkout and the charge landing,
  another buyer can take the last unit. The webhook then fails the stock guard
  and that charge needs refunding by hand.
- ~~**Expired checkout drafts are not swept.**~~ **Fixed** — swept hourly.
- **No vendor moderation audit log.** `Vendor` keeps `rejectionReason`,
  `approvedAt` and `suspendedAt`, but not *which* admin acted, nor the history.
  Copy the `OrderStatusHistory` pattern if that becomes necessary.
- **No per-vendor shipping methods/zones.** One flat fee plus one free-shipping
  threshold per store. A `ShippingMethod` model hanging off `Vendor` is the
  extension point.
- Two pre-existing `onDelete: SetNull` warnings on required columns
  (`Size.sizeGroupId`, `Order.shippingAddressId`) surface on every
  `prisma validate`. Fixing them means making those columns optional, which is
  a frontend contract change, so they were left as they were.
