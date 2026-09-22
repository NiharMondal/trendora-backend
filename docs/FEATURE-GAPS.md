# Feature Gaps & Technical Debt — Backend

_Audited 2026-09-22 against `add-forgot-password-functionality` @ `273b5f1`._
_Re-run this audit whenever the marketplace layer changes._

Every item below is anchored to a `file:line` that was read during the audit. Nothing here is
inferred — if a claim could not be verified in the source, it was dropped rather than guessed.

The companion document is `docs/FEATURE-GAPS.md` in the **frontend** repo
(`github.com/NiharMondal/trendora`). The **Cross-repo contract** section is mirrored in both,
written from each side's point of view.

## How to read this

| | |
| --- | --- |
| **P0** | Unsafe or broken. Ship nothing else until these are closed. |
| **P1** | A user or operator hits this in normal use. |
| **P2** | Polish, scale, or a feature that was never started. |

**Effort** — `S` under half a day · `M` one to two days · `L` more than two days.

IDs are stable. `BE-nn` is a backend item, `XR-nn` a cross-repo contract item; the frontend doc
uses `FE-nn` and the same `XR-nn` numbers.

---

## Summary

| ID | Title | Pri | Eff | Area |
| --- | --- | --- | --- | --- |
| ~~BE-01~~ | ~~`forgot-password` hands a valid JWT to any caller~~ | ✅ **FIXED** 2026-09-22 | — | security |
| BE-02 | IDOR — any user can read/edit/delete any address | P0 | S | security |
| BE-03 | IDOR — any user can read/delete any wishlist row | P0 | S | security |
| BE-04 | `POST /cloudinary/delete-temp` is unauthenticated | P0 | S | security |
| BE-05 | No rate limiting, helmet, body cap or request logging | P0 | M | security |
| BE-06 | `globalErrorHandler` returns the thrown object to the client | P0 | S | security |
| BE-07 | `authGuard` trusts the role in the JWT, not the DB | P0 | S | security |
| BE-08 | `PATCH /users/my-profile-update` has no validation | P0 | S | security |
| BE-09 | A customer cannot cancel their own order | P1 | M | orders |
| BE-10 | Wishlist duplicate check ignores `userId` | P1 | S | wishlist |
| BE-11 | Nothing schedules the refund / checkout sweeps | P1 | M | refunds |
| BE-12 | No transactional email beyond password reset | P1 | L | notifications |
| BE-13 | `OrderStatusHistory` is written and never read | P1 | M | orders |
| BE-14 | `sortBy` is never validated against a column allowlist | P1 | S | query |
| BE-15 | Four list endpoints have no pagination | P1 | S | query |
| BE-16 | `GET /slides` ignores its own `isActive` / `sortOrder` | P1 | S | content |
| BE-17 | No health check endpoint | P1 | S | ops |
| BE-18 | No graceful shutdown; server lies about the DB | P1 | S | ops |
| BE-19 | No env validation at boot | P1 | S | ops |
| BE-20 | `GET /users` returns no email, role or pagination meta | P1 | S | users |
| BE-21 | Brand validation silently drops `logo` | P1 | S | catalogue |
| BE-22 | No test runner, no CI, no Dockerfile | P1 | L | ops |
| BE-40 | `POST /auth/register` returns the bcrypt password hash | P1 | S | security |
| BE-23 | SSLCommerz is dead dependency + dead config | P2 | S | cleanup |
| BE-24 | Six exported helpers have zero callers | P2 | S | cleanup |
| BE-25 | Unreachable enum values (`KIDS`, `FACEBOOK`, `PROCESSING`) | P2 | S | cleanup |
| BE-26 | `address`/`wishlist`/`variant`/`image` modules are half-built | P2 | M | structure |
| BE-27 | `PrismaQueryBuilder` is entirely `any`-typed | P2 | M | types |
| BE-28 | No `Payment` read endpoint | P2 | S | payments |
| BE-29 | No coupons or promotions | P2 | L | marketplace |
| BE-30 | No returns / RMA workflow | P2 | L | marketplace |
| BE-31 | No shipping methods, zones or carrier integration | P2 | L | marketplace |
| BE-32 | No stock reservation; no low-stock alerting | P2 | M | inventory |
| BE-33 | No search facets or full-text index | P2 | L | catalogue |
| BE-34 | Admin user management is one read-only list | P2 | M | users |
| BE-35 | No vendor moderation audit log | P2 | M | marketplace |
| BE-36 | No support tickets, disputes or buyer↔vendor messaging | P2 | L | marketplace |
| BE-37 | Reporting is two hand-rolled dashboard endpoints | P2 | L | analytics |
| BE-38 | Flat platform tax rate only | P2 | L | tax |
| BE-39 | Two `onDelete: SetNull` warnings on required columns | P2 | M | schema |

---

## P0 — unsafe

### ~~BE-01~~ · `forgot-password` hands a valid JWT to any caller
**✅ FIXED — 2026-09-22 · security**

**Was:** `auth.service.ts` returned `{ token, email }`, where `token` was a real access token
minted with the live `ACCESS_TOKEN_SECRET`, to any unauthenticated caller for any registered
email. It 404'd on an unknown address, sent no mail, and had no `/auth/reset-password` to redeem
against.

**Now:** the flow is two public steps and the token never appears in a response.

1. `POST /auth/forgot-password { email }` — generates 32 bytes of CSPRNG output, stores only its
   **SHA-256 hash** in the new `PasswordResetToken` table, and emails
   `${FRONTEND_URL}/reset-password?token=<raw>`. It returns the **same generic 200 for every
   input** — unknown address, deleted user, social-only account, or a request inside the
   per-account cooldown all look identical, so the endpoint is no longer an enumeration oracle.
2. `POST /auth/reset-password { token, newPassword }` — hashes the supplied token, requires an
   unused and unexpired row, updates the password and retires **every** outstanding token for that
   account in one transaction. Unknown, expired, used and malformed tokens all return the same
   message.

Supporting pieces: `src/utils/sendEmail.ts` (the reusable transport, BE-12),
`src/utils/email-templates.ts`, the `PasswordResetToken` model
(migration `20260922094138_password_reset_tokens`), and `PASSWORD_RESET_TTL_MINUTES` /
`PASSWORD_RESET_COOLDOWN_SECONDS` in `.env.example`.

**Verified end to end** against the dev database: unknown / social-only / real addresses return
byte-identical bodies; exactly one token row is created and only for an account that has a
password; the SHA-256 hash is 64 hex chars; a valid token resets the password (old password stops
working, new one logs in); replay, expiry and unknown tokens all fail closed; a second request
inside the cooldown issues no new token and sends no second mail; a request after the cooldown
issues a new token and retires the old one.

**Still open, deliberately out of scope here:**
- **No rate limiting** on either endpoint beyond the per-account cooldown — BE-05.
- **A social-only (Google) account cannot set a password this way.** It is skipped silently, which
  is consistent with `changePassword` refusing for the same reason, but it is a UX dead end: the
  user gets the generic "link sent" and no mail arrives. Letting them *set* a first password would
  need its own deliberate flow.
- `processPendingRefunds`-style housekeeping: used and expired `PasswordResetToken` rows are never
  swept. Harmless — a used row can never be redeemed again — but they accumulate. Fold into BE-11.

---

### BE-02 · IDOR — any user can read, edit or delete any address
**P0 · S · security**

**Now:** `src/modules/address/address.service.ts:43` (`findById`), `:51` (`updateData`) and `:64`
(`deleteData`) all look the row up by `id` alone. `src/modules/address/address.controller.ts:40`,
`:51` and `:61` pass only `req.params.id` — `req.user.id` is never consulted. The routes *are*
guarded (`src/modules/address/address.route.ts:21,25,30`), but `authGuard` only checks role, never
ownership.

**Gap:** Any signed-in account can read, overwrite or delete any other user's address — names,
phone numbers and street addresses of the whole customer base. `deleteData` is additionally a
**hard** `prisma.address.delete` (`address.service.ts:67`) even though `Address.isDeleted` exists
(`prisma/schema.prisma:73`) and `Order.shippingAddressId` references the row
(`prisma/schema.prisma:410`).

**Fix:** Scope every one of the three by `userId`, the way `src/modules/review/review.service.ts:155`
already does, and return **404 rather than 403** on a mismatch so another user's ids stay
unguessable — the convention `src/helpers/vendor.ts` uses for `assertVendorOwnsProduct`. Switch
the delete to `isDeleted: true`.

---

### BE-03 · IDOR — any user can read or delete any wishlist row
**P0 · S · security**

**Now:** `src/modules/wishlist/wishlist.service.ts:57` (`findById`) and `:65` (`deleteData`) use
the raw `id`; `src/modules/wishlist/wishlist.controller.ts:32,43` never pass the caller.

**Gap:** Same shape as BE-02 — one user can delete items out of another's wishlist. Lower impact
(no PII), same root cause.

**Fix:** As BE-02. Scope by `userId`, 404 on mismatch.

---

### BE-04 · `POST /cloudinary/delete-temp` is completely unauthenticated
**P0 · S · security**

**Now:** `src/modules/cloudinary/cloudinary.route.ts:7` registers an inline handler with **no
`authGuard` and no `validateRequest`**. The only check is `publicId.includes("/temp/")` at `:10`.
The module has no controller, service or validation file — the logic lives in the route.

**Gap:** Anyone on the internet can delete any Cloudinary asset whose public id contains `/temp/`.
A path substring is a naming convention, not an authorization decision. Separately, `publicId` is
read straight off `req.body`, so a request without it throws a TypeError on `.includes` and
returns a 500.

**Fix:** Guard it with `authGuard(Role.CUSTOMER, Role.VENDOR, Role.ADMIN)` — only a signed-in user
is mid-upload — and add a Zod schema requiring `publicId`. Keep the `/temp/` check as a second
line of defence; the frontend relies on that guard too
(`frontend/src/shared/lib/delete-temp-image.ts`). While here, give the module the standard
route/controller/service/validation shape.

---

### BE-05 · No rate limiting, helmet, body-size cap or request logging
**P0 · M · security**

**Now:** `src/app.ts:8-20` is the entire middleware stack: the Stripe webhook, `express.json()`
with no options, and `cors`. There is no `express-rate-limit`, no `helmet`, no morgan/pino in
`package.json:26-54`.

**Gap:**
- `POST /auth/login`, `/auth/register` and `/auth/forgot-password` can be hit without limit —
  credential stuffing and enumeration (BE-01) are unthrottled.
- `express.json()` with no `{ limit }` accepts an arbitrarily large body.
- No security headers.
- No request log, so there is no way to investigate an incident after the fact.

**Fix:** Add `helmet()`, `express.json({ limit: "1mb" })`, a global limiter plus a much tighter one
on the `/auth` router, and a structured request logger. All four are middleware-stack additions in
`src/app.ts` above `rootRouter` — the Stripe webhook at `:12` must stay first.

---

### BE-06 · `globalErrorHandler` returns the thrown object to the client
**P0 · S · security**

**Now:** `src/middleware/globalErrorHandler.ts:13-17` builds
`{ statusCode, message, errorDetails: error }`. The Zod branch (`:19-29`) and the Prisma branches
(`:31-54`) replace `errorDetails` with something safe, but **anything else falls through with the
raw thrown value in place**, and it is serialized at `:57-61`.

**Gap:** Whatever enumerable properties the thrown object carries go to the client — for an
unknown Prisma error that includes `clientVersion` and `meta`. Any future `throw` of an object
with context attached leaks it. There is also a stray `console.log(error)` at `:41` inside the
Prisma-validation branch.

**Fix:** Default `errorDetails` to `null`, and only populate it from an explicit allowlist. Log
the full error server-side through the logger from BE-05 instead of returning it. Note `P2025`
(record not found) is also mapped to **400** at `:49-53`, which should be 404.

---

### BE-07 · `authGuard` trusts the role in the JWT rather than the database
**P0 · S · security**

**Now:** `src/middleware/authGuard.ts:20` destructures `role` out of the decoded token, and `:43`
checks `roles.includes(role)` — even though `:30-38` has *already loaded* the `User` row with
`auth` included.

**Gap:** Role changes do not take effect until the access token expires. An admin demoted to
CUSTOMER, or a VENDOR whose store is suspended, keeps their old privileges for up to 20 minutes
(`src/helpers/jwt.ts:4`). The correct value is sitting unused in `user.auth.role`.

**Fix:** Authorize against `user.auth.role`, not `decodeToken.role`. The row is already fetched,
so this costs nothing.

---

### BE-08 · `PATCH /users/my-profile-update` has no `validateRequest`
**P0 · S · security**

**Now:** `src/modules/user/user.route.ts:8-12` wires the controller directly. `userUpdateSchema`
exists at `src/modules/user/user.validation.ts:3-12` and the service even imports its inferred
type — but the middleware is never applied.

**Gap:** An unvalidated `req.body` reaches `prisma.user.update`. Every other write route in the
repo is validated; this one is the exception.

**Fix:** Add `validateRequest(userUpdateSchema)`. Note the schema currently requires
`name.min(5)` while the frontend form allows `min(1)`
(`frontend/src/features/users/schemas/profile-form.schema.ts:4`) — relax the backend to `min(1)`
or tighten the frontend in the same change, or wiring it up will start rejecting short names.
See **XR-04**.

---

## P1 — a user or operator hits this

### BE-09 · A customer cannot cancel their own order
**P1 · M · orders**

**Now:** Fulfilment moves through `PATCH /orders/vendor-orders/:vendorOrderId/status`, guarded
`authGuard(Role.VENDOR, Role.ADMIN)` (`src/modules/order/order.route.ts:36-40`). The old
whole-order status route was deliberately removed (`:10-14`). No other cancel route exists.

**Gap:** A buyer has no way to cancel a parcel they just ordered. The refund ledger, the Stripe
refund path and `ensureTransitionAllowedForRole` all exist and work — there is simply no door for
a CUSTOMER to walk through. They must contact the seller.

**Fix:** Either add `Role.CUSTOMER` to that guard and extend
`ensureTransitionAllowedForRole` so a buyer may only move `PENDING|PROCESSING → CANCELED` on a
parcel they own, or add a dedicated `POST /orders/vendor-orders/:id/cancel`. Reuse
`assertVendorOwnsVendorOrder`'s 404-not-403 pattern for the ownership check.

---

### BE-10 · Wishlist duplicate check ignores `userId`
**P1 · S · wishlist**

**Now:** `src/modules/wishlist/wishlist.service.ts:21-26` guards with
`findFirst({ where: { productId: payload.productId } })` — no `userId`.

**Gap:** Once *any* user wishlists a product, **every other user** gets
`400 "Sorry, This product already exist"` for it. The Prisma model has the correct
`@@unique([userId, productId])` (`prisma/schema.prisma:323`); only the application-level guard is
wrong. Popular products become un-wishlistable platform-wide.

**Fix:** Add `userId` to the `where`. Better: drop the pre-check entirely and let the unique
constraint raise `P2002`, which `globalErrorHandler` already maps. `POST /wishlists` also has no
`validateRequest` despite `wishlist.validation.ts:3` existing.

---

### BE-11 · Nothing schedules the refund and checkout sweeps
**P1 · M · refunds**

**Now:** `processPendingRefunds` (`src/helpers/refund.ts:427`) is reachable only from the manual
`POST /refunds/retry-all` (`src/modules/refund/refund.service.ts:211`).
`expireStaleCheckoutSessions` (`src/helpers/checkout.ts:136`) has **zero callers**. Both carry
comments saying nothing schedules them yet. There is no `node-cron`, `bullmq`, `setInterval` or
worker entrypoint anywhere in the repo.

**Gap:** A refund that fails at the gateway sits `FAILED` until an admin notices `/admin/refunds`
— that is a buyer who has not been paid back. A refund left `PROCESSING` is never polled at all
(`retrieveStripeRefund`, `src/helpers/stripe.ts:142`, has zero callers), so if the
`refund.updated` webhook is missing it stays `PROCESSING` forever. Expired checkout drafts
accumulate harmlessly but indefinitely.

**Fix:** Add a scheduler entrypoint and run `processPendingRefunds()` and
`expireStaleCheckoutSessions()` on a timer — both are idempotent and safe. Add a third sweep that
polls `PROCESSING` refunds via `retrieveStripeRefund`.

---

### BE-12 · No transactional email beyond password reset
**P1 · L · notifications**

**Now:** the transport exists and is reusable — **this half is done.**
`src/utils/sendEmail.ts` owns the single pooled nodemailer transport and exposes
`sendEmail` (throws) and `sendEmailSafely` (logs and returns `false`), plus `isEmailConfigured`
so an environment with no SMTP credentials skips mail instead of failing the request that
triggered it. Bodies live in `src/utils/email-templates.ts`, one exported function per message
returning `{ subject, html, text }`, so a caller cannot forget the plain-text fallback.

Two templates exist, both wired into the password-reset flow (BE-01): `passwordResetEmail` and
`passwordChangedEmail`.

**Gap:** every *other* notification is still missing. No order confirmation, no shipping notice,
no refund confirmation, no vendor application decision, no payout notice. A seller still learns
about a new order only by opening the dashboard.

**Fix:** Add a template per event and call `sendEmailSafely` from the existing hook points:
`persistOrder` (`src/helpers/create-order.ts`), the vendor-order status transition,
`processRefund`, the vendor approve/reject handlers, and the payout mark-paid path. Keep using
`sendEmailSafely` rather than `sendEmail` — a mail outage must not roll back a committed
transaction, the same reasoning that keeps the gateway call outside the transaction in
`src/helpers/refund.ts`.

There is still no *in-app* notification model; that remains unstarted.

---

### BE-13 · `OrderStatusHistory` is written and never read
**P1 · M · orders**

**Now:** The model exists (`prisma/schema.prisma:584`) and is written in exactly one place,
`src/helpers/order.ts:365`. Nothing reads it; no endpoint surfaces it.

**Gap:** The fulfilment audit trail is collected and discarded. Neither a buyer, a seller nor an
admin can see when a parcel changed hands — which is the first thing anyone asks in a dispute.

**Fix:** Include it on `getOrderById` and on the vendor-order detail read, or add
`GET /orders/vendor-orders/:id/history`. The data is already there.

---

### BE-14 · `sortBy` is never validated against a column allowlist
**P1 · S · query**

**Now:** `PrismaQueryBuilder` supports `allowedFields` (`src/lib/PrismaQueryBuilder.ts:52`) but
**not one service passes it**, so `sort()` (`:288-305`) drops the raw field name straight into
Prisma `orderBy`.

**Gap:** Any sort option naming a non-column produces a Prisma 500 rather than a 400. The
frontend already ships one: `userSortOptions` offers `email:asc`
(`frontend/src/shared/constants/sort-options.ts:16-23`), and `email` lives on `Auth`, not `User`.
It only escapes today because `GET /users` bypasses the query builder entirely (BE-20) — fixing
BE-20 turns this into a live 500. See **XR-08**.

**Fix:** Pass `allowedFields` from every service that calls `.sort()`, and have the builder reject
an unknown field with a 400.

---

### BE-15 · Four list endpoints have no pagination
**P1 · S · query**

**Now:** `GET /users` (`src/modules/user/user.service.ts:6-10`), `GET /address`
(`src/modules/address/address.service.ts:21-25`) and `GET /wishlists/my-wishlist`
(`src/modules/wishlist/wishlist.service.ts:35`) are bare `findMany()` calls that never touch
`PrismaQueryBuilder`. `GET /users` additionally has no `isDeleted` filter.

**Gap:** These grow without bound and return no `meta`, so the frontend's pagination is dead on
arrival (see BE-20). Soft-deleted users are returned to the admin list.

**Fix:** Route all three through `PrismaQueryBuilder` with `.withDefaultFilter({ isDeleted: false })`,
as `src/modules/brand/brand.service.ts` does. While in `address.service.ts:27-34`, note
`findMyAddress` runs the same `findMany` **twice** and discards the first result.

---

### BE-16 · `GET /slides` ignores its own `isActive` and `sortOrder`
**P1 · S · content**

**Now:** `src/modules/slide/slide.service.ts:13-22` hardcodes `take: 4` and applies neither
`isActive`, `isDeleted` nor `sortOrder`, all of which exist on the model
(`prisma/schema.prisma:652-654`).

**Gap:** An operator cannot deactivate or reorder a hero slide; the columns are decorative. The
storefront always gets the same arbitrary four.

**Fix:** Filter on `isActive: true, isDeleted: false` and order by `sortOrder`. Related frontend
gap: there is no admin screen to manage slides at all (**FE-14**).

---

### BE-17 · No health check endpoint
**P1 · S · ops**

**Now:** The only root handler is **commented out** at `src/app.ts:23-25`. Grep for `health` or
`ping` across `src/` returns nothing.

**Gap:** No load balancer, container orchestrator or uptime monitor can tell whether the process
is alive, let alone whether it can reach the database.

**Fix:** Add `GET /health` returning 200, and a `GET /health/ready` that runs `SELECT 1` through
Prisma. Register it in `src/app.ts` above `rootRouter` so it is not behind `/api/v1`.

---

### BE-18 · No graceful shutdown, and the server lies about the database
**P1 · S · ops**

**Now:** `src/server.ts:5-10` is `app.listen` and two `console.log`s. One of them prints
`"Database connected"` — unconditionally, without ever connecting. There is no SIGTERM/SIGINT
handler, no `prisma.$disconnect()`, no `unhandledRejection` or `uncaughtException` handler.

**Gap:** A deploy or container stop kills in-flight requests mid-transaction. The misleading log
line will cost someone an hour the first time the DB is actually down.

**Fix:** `await prisma.$connect()` before `listen` (and log honestly), keep the server handle, and
on SIGTERM/SIGINT stop accepting connections, drain, then `$disconnect()`. Add process-level
handlers that log and exit non-zero.

---

### BE-19 · No env validation at boot
**P1 · S · ops**

**Now:** `src/config/env-config.ts` reads 22 keys with no validation layer. A missing
`ACCESS_TOKEN_SECRET` is papered over with `as string` at `src/middleware/authGuard.ts:18`.

**Gap:** A misconfigured deploy boots successfully and fails at the first authenticated request,
with an error that does not name the missing variable.

**Gap, concretely:** the live `.env` is currently missing `PLATFORM_COMMISSION_RATE`,
`CHECKOUT_SESSION_TTL_MINUTES` and `SEED_PASSWORD`, so the server is silently running on the
hardcoded fallbacks at `env-config.ts:44,48,30` — including the platform's commission rate.

**Fix:** Parse `process.env` through a Zod schema in `env-config.ts` and throw at import time.
Note `src/config/db.ts:7` reads `process.env.NODE_ENV` directly, bypassing `envConfig` and
contradicting the convention in `CLAUDE.md` § Config.

---

### BE-20 · `GET /users` returns no email, role or pagination meta
**P1 · S · users**

**Now:** `src/modules/user/user.service.ts:6-10` is `prisma.user.findMany()` with no `auth`
include — and email and role live on `Auth`, not `User` (`prisma/schema.prisma:49-59`). The
controller (`src/modules/user/user.controller.ts:6-14`) sends no `meta`. The service is also
missing an `await`; it happens to work because the controller awaits the returned promise, but it
is misleading.

**Gap:** The admin user table is permanently blank in its Email and Role columns and its
pagination never appears, because the frontend types both fields as required and feeds `meta` to
`DataTable`. See **XR-05**.

**Fix:** Route through `PrismaQueryBuilder` (BE-15), `include: { auth: { select: { email: true, role: true } } }`,
and return `meta`. Decide with the frontend whether email/role arrive nested under `auth` or
flattened — the frontend type currently expects them flat.

---

### BE-21 · Brand validation silently drops `logo`
**P1 · S · catalogue**

**Now:** `src/modules/brand/brand.validation.ts:3-8` declares **only** `name`.
`src/middleware/validateRequest.ts:12` replaces `req.body` with the parsed result, and Zod strips
unknown keys, so `logo` never reaches the service — although `Brand.logo` exists
(`prisma/schema.prisma:187`) and the frontend sends it.

**Gap:** Brand logos can never be saved, through any path, and the request succeeds with a 200 so
nothing signals the loss. See **XR-03**.

**Fix:** Add `logo: z.string().optional()` to `brandSchema`. Audit the other validation schemas
for the same omission — `validateRequest`'s strip-on-parse means any field missing from a schema
is discarded silently.

---

### BE-22 · No test runner, no CI, no container
**P1 · L · ops**

**Now:** No `test` script (`package.json:6-18`), no `*.test.ts`/`*.spec.ts`, no jest/vitest/
supertest. No `.github/`, no Dockerfile, no compose file.

**Gap:** The money paths — `validateAndCalculateOrder`, the commission/earning invariant in
`assertCalculationBalances`, `deriveOrderStatus`, the refund idempotency layers — are the parts of
this codebase most expensive to get wrong and have no automated coverage at all. Verification is
currently `pnpm lint` + `pnpm build` + clicking through the UI.

**Fix:** Add vitest + supertest and start with those money helpers, which are pure functions and
need no database. Then a CI workflow running lint, build and test on push.

---

### BE-40 · `POST /auth/register` returns the bcrypt password hash
**P1 · S · security**

**Now:** `registerUser` (`src/modules/auth/auth.service.ts:16-46`) returns the raw
`$transaction` result `{ user, auth }`, and `auth` is the whole row — including
`auth.password`, the bcrypt hash. The controller passes it straight to `sendResponse`.

Confirmed live during the BE-01 verification: a registration response body contains
`"password":"$2b$10$ipSO4f3l...."`.

**Gap:** A password hash should never leave the server. It is only ever disclosed to the account
holder who just chose that password, so the direct risk is limited — but it lands in access logs,
proxy logs, browser devtools history and any client-side error reporting, which is exactly how
hashes end up somewhere they can be attacked offline. `bcrypt` cost 10 is not a large barrier for
a weak password.

**Fix:** Return a projection, not the row — `{ id, name, email, role }` is what the client needs.
The frontend's `TAuthRegisterResponse` already expects a flat shape and does not match the current
nested `{ user, auth }` either (XR-05), so both can be settled in one change.

---

## P2 — cleanup, and features never started

### BE-23 · SSLCommerz is a dead dependency and dead config
**P2 · S · cleanup**

`sslcommerz-lts` is a **production** dependency (`package.json:37`) with zero imports.
`src/types/ssl-commerz.d.ts:1-44` is a full ambient declaration, never referenced.
`envConfig.ssl` (`src/config/env-config.ts:15-19`) has zero consumers. Four env keys
(`SSL_STORE_ID`, `SSL_STORE_PASSWORD`, `SSL_COMMERZ_API`, `SSL_VALIDATION_API`) are declared in
`.env.example:31-34` and read by nothing; `SSL_VALIDATION_API` is not even in `env-config.ts`.
`PaymentMethod` has no SSLCommerz member (`prisma/schema.prisma:706-709`).

**Fix:** Remove all of it, or open a ticket to actually implement it. Today it is pure noise that
tells every new contributor SSLCommerz is a required integration.

---

### BE-24 · Six exported helpers have zero callers
**P2 · S · cleanup**

`cancelCheckoutSession` (`src/helpers/checkout.ts:125`), `retrieveStripeRefund`
(`src/helpers/stripe.ts:142`), `outstandingRefundForOrder` (`src/helpers/refund.ts:454`),
`expireStaleCheckoutSessions` (`src/helpers/checkout.ts:136`), `generateTransactionId` (the whole
of `src/helpers/generateTransactionId.ts`) and `uuidSchema` (`src/utils/utils.ts:4`).

Two of these are load-bearing for BE-11 and should be *wired up* rather than deleted;
`generateTransactionId` and `uuidSchema` are genuinely dead. Also unused: the `axios` and
`@prisma/extension-accelerate` dependencies.

---

### BE-25 · Unreachable enum values
**P2 · S · cleanup**

- `Gender.KIDS` (`prisma/schema.prisma:740`) — zero references in `src/`, including the seed.
- `AuthProvider.FACEBOOK` (`:747`) — appears only in a validation error string
  (`src/modules/auth/auth.validation.ts:41-42`); no Facebook OAuth exists.
- `PayoutStatus.PROCESSING` (`:714`) — `payout.service.ts` only ever writes `PENDING` (`:143`),
  `PAID` (`:197`) and `FAILED` (`:234`).
- **`AuthProvider` has no Zod mirror** in `src/helpers/enum.ts`, which mirrors the other nine.
  The hand-rolled inline copy at `auth.validation.ts:37-43` accepts only `GOOGLE | FACEBOOK` and
  drops `EMAIL` — the Prisma default. This breaks the "enums live in three places, all must
  agree" rule stated at `prisma/schema.prisma:663-664`. See **XR-09**.

---

### BE-26 · Four modules are half-built
**P2 · M · structure**

- `src/modules/product-variant/` and `src/modules/product-image/` expose **GET only**
  (`variant.route.ts:6`, `image.route.ts:6`); every write is buried in `product.service.ts`.
  `image.service.ts:4` even names its variable `variants` — a copy-paste from the sibling module.
  Both read endpoints are called by nothing (**XR-02**).
- `src/modules/cloudinary/` has no controller, service or validation file (see BE-04).
- `payment.validation.ts` and `image.validation.ts` are **0-byte files**.

---

### BE-27 · `PrismaQueryBuilder` is entirely `any`-typed
**P2 · M · types**

`src/lib/PrismaQueryBuilder.ts:1` carries a file-level
`/* eslint-disable @typescript-eslint/no-explicit-any */` and uses ~18 `any`s. Every list endpoint
in the app goes through it, so the one piece of shared infrastructure handling untrusted query
input has no type safety. (Credit where due: there is **zero** `any` in any `*.service.ts`.)

---

### BE-28 · No `Payment` read endpoint
**P2 · S · payments**

The `Payment` model (`prisma/schema.prisma:506`) has full gateway fields but is only ever written,
by the webhook. There is no `GET /payments*` route. The frontend nonetheless declares a `payments`
RTK Query tag, which no endpoint provides (**XR-07**).

---

### BE-29 → BE-39 · Marketplace capabilities not started

| ID | Capability | Nearest existing thing |
| --- | --- | --- |
| BE-29 | **Coupons / promo codes.** No model, no module. `Order.discount` and `OrderItem.discount` (`schema.prisma:397,491`) are always derived from `basePrice − discountPrice`; `DISCOUNT_RATE` sits unread in `.env.example:46` | per-product `discountPrice` |
| BE-30 | **Returns / RMA.** There is a refund *ledger* but no return request, RMA number, return shipping or restocking flow. `OrderStatus` has no `RETURNED` (`schema.prisma:687-693`) | `Refund` |
| BE-31 | **Shipping methods, zones, carriers.** One flat fee + one threshold per store (`schema.prisma:123-124`). `VendorOrder.carrier` / `trackingNumber` (`:450-451`) are free text with no carrier registry or tracking API | flat per-vendor fee |
| BE-32 | **Stock reservation and low-stock alerts.** Stock is deducted at COD creation or at the Stripe webhook, so the last unit can be sold twice between checkout and charge — the webhook then fails the stock guard and that charge needs refunding by hand | conditional `updateMany` guard |
| BE-33 | **Search facets / full-text.** `.search()` is a naive `contains` over `name` and `description` (`product.service.ts:172`). No price/rating/colour/size/in-stock facet counts, no full-text index | `?search=` substring |
| BE-34 | **Admin user management.** `GET /users` is the only admin user route. No get-by-id, no ban, no soft-delete, no role assignment — a `Role` can only change via vendor approval or a manual DB edit | `GET /users` |
| BE-35 | **Vendor moderation audit log.** `Vendor` keeps `rejectionReason`, `approvedAt`, `suspendedAt` (`schema.prisma:107-110`) but not *which* admin acted, nor the history. Copy the `OrderStatusHistory` pattern | three columns |
| BE-36 | **Support tickets, disputes, buyer↔vendor messaging.** None. Refund `reason` is free text (`schema.prisma:557`) | — |
| BE-37 | **Reporting.** Two hand-rolled endpoints: `GET /orders/analytics` and `GET /vendors/me/dashboard`. No date ranges, no export, no sales-by-period, no cohorts | two dashboards |
| BE-38 | **Tax rules.** One flat platform rate. No jurisdiction, no per-category rate, no exemption, no VAT/GST id on orders | `TAX_RATE` |
| BE-39 | **Schema warnings.** Two `onDelete: SetNull` on required columns (`Size.sizeGroupId`, `Order.shippingAddressId`) surface on every `prisma validate`. Fixing means making them optional, which is a frontend contract change | — |

Also absent: server-side cart (cart lives in frontend localStorage; only `CheckoutSession` exists
server-side), product Q&A, comparison, recently-viewed, bundles, gift cards, loyalty,
multi-currency, i18n.

---

## Cross-repo contract

_Mirrored in `docs/FEATURE-GAPS.md` of the frontend repo. The two repos share only HTTP, so a
change here is always two commits on two branches._

### XR-01 · Tax and port defaults disagree across four files
**P1 · S · config**

| Source | `TAX_RATE` |
| --- | --- |
| `src/config/env-config.ts:32` (code fallback) | **0.08** |
| `.env.example:40` and the live `.env` | **0.05** |
| `frontend/.env.local` (`NEXT_PUBLIC_TAX_RATE`) | **0.05** |
| `frontend/src/features/cart/utils/calculate-order-total.ts:26` (code fallback) | **0** |

The running pair agrees at 0.05, so checkout is correct today. But a deploy that forgets the
variable charges **8% server-side while the cart displays 0%** — the buyer is billed more than
they were quoted, silently, because the backend recomputes and never trusts the client.

`PORT` is similarly muddled: `env-config.ts:8` defaults to `5000`, `.env` and `.env.example` say
`5001`, `pnpm stripe:listen` forwards to `5001`, and the root `CLAUDE.md` documents `5000`.

**Fix:** Make both code fallbacks match `.env.example`, or (better) make `TAX_RATE` required by
the env validation in BE-19 so it can never silently default. Settle on one port everywhere.

---

### XR-02 · Endpoints that exist on one side only
**P2 · S · contract**

**Frontend calls that would 404 here** — both currently unmounted, so latent rather than live:
- `GET /auth/google` (`frontend/src/features/auth/api/auth.api.ts:38-43`) — wrong path *and*
  wrong verb; the real endpoint is `POST /auth/oauth-login` (`src/modules/auth/auth.route.ts:22`),
  which NextAuth correctly calls directly.
- `DELETE /users/:id` (`frontend/src/features/users/api/user.api.ts:48-53`) — no such route
  (`src/modules/user/user.route.ts`), no `deleteUser` in the controller or service.

**Routes here that no frontend code calls:** `POST /auth/forgot-password` and `POST /auth/reset-password` (both now correct and waiting on the frontend — XR-11);
`GET /products/:productId/variants` and `GET /products/:productId/images` (variants and images
always arrive nested); `GET /wishlists/:id`; `PATCH`/`DELETE /vendor-reviews/:id`;
`GET /vendor-reviews/my-reviews`; `GET /address` (admin list); the whole slide write CRUD;
`GET /payouts/:id`; `GET /refunds/:id`. Each is a screen the frontend planned and did not build —
see FE-14 and the frontend's unused-hook list. The Stripe webhook routes are correctly excluded
from this count.

---

### XR-03 · Brand `logo` is stripped before the service sees it
**P1 · S · contract**

See BE-21. The frontend sends `logo` (`frontend/src/features/brands/schemas/brand-form.schema.ts:5`),
`brandSchema` does not declare it, `validateRequest` strips it, the request returns 200, the logo
is gone. **A one-line fix on this side; nothing to change on the frontend.**

---

### XR-04 · A rating-only review always 400s
**P1 · S · contract**

`src/modules/review/review.validation.ts:5-10` declares
`comment: z.string().min(5).max(400).trim().optional()`. The frontend initialises
`comment: ""` (`frontend/.../write-review.tsx:23`) and submits the form values verbatim at `:33`.
An empty string is *present*, so `.optional()` does not apply and `.min(5)` fires.

Every buyer who rates a product without writing a comment gets a 400 whose message is
**"Min length is 2"** — a stale string that does not even match the rule. The update schema has
the same shape with `min(2)` (`:21`).

**Fix here:** preprocess empty-to-undefined (`z.preprocess(v => v === "" ? undefined : v, …)`) and
correct the message. **Fix there:** strip an empty `comment` before submitting. Either alone
closes it; doing both is cheap.

---

### XR-05 · Payload shapes the frontend expects but this side does not send
**P1 · M · contract**

| What the frontend expects | What this side returns |
| --- | --- |
| `TUser.email`, `TUser.role` required; `meta` for pagination | `GET /users` sends neither — BE-20 |
| `TProductVariant.size` required | `findAllFromDB` (`product.service.ts:176-184`) and `findById` (`:266-276`) include `variants: true` with **no `size` relation**; only `findBySlug` (`:312-330`) and the vendor read do. `variant.size.name` throws off `/products` and `/products/:id` |
| `TProductImage.productId`, `.publicId`, `.isDeleted` required | list reads select only `{id, url, isMain}` (`product.service.ts:178,220,247`) |
| `TOrder.user.email` flat | nested as `user.auth.email` (`order.service.ts:194-205, 332-341`) — always `undefined` on the frontend |
| `TOrder.user` required | `GET /orders/my-orders` (`order.service.ts:233-289`) does not include `user` at all |
| Order money fields required `string` | `getOrderById` deliberately returns them `undefined` for a VENDOR (`order.service.ts:365-372`) |
| `TVendor._count.payouts` | `findAllForAdmin` selects `_count: { products, vendorOrders }` only (`vendor.service.ts:278`) |
| `TSlide` has no `sortOrder`/`isActive` | the columns exist here and drive BE-16 |
| `TReview.rating: number` | `Review.rating` is `Decimal` (`schema.prisma:329`) → JSON **string** |
| `ShippingSnapshot.state` required, no `email` | `Address.state` is nullable and `email` is required (`schema.prisma:65,69`) |

Most of these are frontend type corrections; **BE-20 and the missing `size` include are ours.**

---

### XR-06 · Form/schema bounds that disagree
**P2 · S · contract**

- **Variant stock:** frontend `z.coerce.number().positive()` forbids `0`; here
  `product.validation.ts:17` is `z.number().min(0)`. A vendor cannot mark a variant out of stock
  from the UI. *(Frontend fix.)*
- **Size group:** frontend marks `sizeGroupId` optional; `size.validation.ts:5` requires it — a
  400 the form cannot prevent. *(Frontend fix.)*
- **Profile name:** `userUpdateSchema` requires `min(5)`, the frontend form `min(1)`. Currently
  invisible because BE-08 never applies the schema; wiring it up makes short names start failing.
- **Vendor `payoutDetails`:** `applySchema` accepts it (`vendor.validation.ts:42`) but the
  frontend application form never sends it, so a seller can never supply bank details at
  application time. *(Either side.)*

---

### XR-07 · Free shipping diverges when the threshold is `0`
**P1 · S · money**

`src/helpers/order.ts:238-241` charges `subtotal >= freeShippingThreshold ? 0 : shippingFee`. At a
threshold of `0`, `subtotal >= 0` is always true, so **shipping is free**. The frontend requires
`freeShippingThreshold > 0 && subtotal >= threshold`
(`frontend/src/features/cart/utils/calculate-order-total.ts:61-62`), so at `0` it **charges the
full fee**.

The vendor settings form explicitly permits `0` (`.min(0)`), so a seller can put their store into
this state. The cart then quotes a shipping fee the backend will not charge — the buyer is
over-quoted and pays less than displayed, which is the harmless direction, but the two
implementations disagree and `CLAUDE.md` promises they agree to the cent.

**Fix:** Decide what `0` means. Recommended: `0` means "free shipping always" — make the frontend
drop its `> 0` guard to match this side, since this side is authoritative.

---

### XR-08 · Query-param conventions agree; two sharp edges remain
**P2 · S · query**

The reserved names and defaults match: `buildQueryParams` defaults `page:1, limit:10, search:"",
sortBy:"createdAt:desc"`, and `PrismaQueryBuilder.ts:156-164` reserves `search, page, limit,
sortBy, sort, orderBy, order` with the same defaults. **No list screen currently sends a param
that would become a bogus column filter.** Two caveats:

- `useTableFilters` defaults `limit` to `"20"` while `buildQueryParams` strips `"10"` as the
  default. Choosing "10" in the dropdown drops the param and this side falls back to 10 — the
  right answer by coincidence. If either default moves, the limit selector starts lying.
- `sortBy` is unvalidated (BE-14), and `userSortOptions` already offers a non-column.

---

### XR-09 · Enum drift
**P2 · S · contract**

`prisma/schema.prisma:667-748` and `src/helpers/enum.ts:10-66` **agree on all nine mirrored
enums**. The gaps are at the edges:

- **`AuthProvider` has no Zod mirror**, and the inline copy at `auth.validation.ts:37-43` drops
  `EMAIL` (BE-25).
- The frontend has **two copies of `PaymentStatus`**, and one of them —
  `frontend/src/features/orders/utils/payment-status.ts:3-8` — is **missing
  `PARTIALLY_REFUNDED`**, so a partially-refunded order renders with *Pending* styling. *(Frontend
  fix.)*
- The frontend carries three phantom types with no counterpart here: `TUserStatus`,
  `TCouponStatus`, and a pre-marketplace `TProductStatus` of `ACTIVE | INACTIVE | OUT_OF_STOCK`.
  *(Frontend fix.)*
- `EnumUserRole.SUPER_ADMIN` exists only on the frontend — deliberate; see "Verified NOT a gap".

---

### XR-10 · CORS is hardcoded; the frontend has no `.env.example`
**P1 · S · config**

`src/app.ts:18` pins `origin: ["http://localhost:3000"]` while `FRONTEND_URL` is defined in env
(`env-config.ts:12`) and used only for Stripe redirect URLs (`src/helpers/stripe.ts:83-84`). The
backend therefore **cannot be deployed without editing source**.

Symmetrically, the frontend has **no `.env.example`** — only a gitignored `.env.local` — so none
of its six required variables are documented anywhere but `CLAUDE.md`.

**Fix:** Read the origin from `envConfig.front_end_url` (accept a comma-separated list). Add
`frontend/.env.example`.

---

### XR-11 · Password reset — backend done, frontend pending
**P1 · M · auth**

**Updated 2026-09-22.** The backend half is complete (BE-01); the frontend half is not.

| Piece | State |
| --- | --- |
| `POST /auth/forgot-password` | ✅ emails a single-use link, returns a generic 200, never returns the token |
| `POST /auth/reset-password` | ✅ redeems the token and sets the new password |
| Email delivery | ✅ `src/utils/sendEmail.ts` + `passwordResetEmail` template |
| Token storage | ✅ `PasswordResetToken`, SHA-256 hashed, TTL + single-use + supersede |
| Forgot-password form (frontend) | ❌ still `console.log(data)` — never calls the API (FE-04) |
| `/reset-password` page (frontend) | ❌ does not exist |

**The contract the frontend must meet:**

```
POST /auth/forgot-password   { email }
  -> 200 { success: true, message: "If an account exists…", result: null }   ALWAYS
     Render that message verbatim. Do NOT branch on whether the account exists —
     the endpoint is deliberately identical for every input.

POST /auth/reset-password    { token, newPassword }
  -> 200 { success: true, message: "Password has been reset successfully…", result: null }
  -> 400 "This password reset link is invalid or has expired. Please request a new one."
     Covers unknown, expired, already-used and malformed tokens, deliberately
     indistinguishable. Surface it as-is and offer a link back to /forgot-password.
```

The emailed link is **`${FRONTEND_URL}/reset-password?token=<raw>`**, so the frontend must serve
that exact path and read `?token=`. `FRONTEND_URL` is `http://localhost:3000` in dev.
`newPassword` must satisfy the shared `passwordRule` in `auth.validation.ts`: 6–30 chars, at least
one letter and one number.

**Note:** a social-only (Google) account is skipped silently — it has no password to reset, so the
generic "link sent" is returned and no mail arrives. Consistent with `changePassword`, but a UX
dead end worth handling on the frontend copy eventually.

---

## Verified NOT a gap

Things that look wrong at a glance and are deliberate. Please do not re-raise these without
reading the reasoning.

- **The Stripe webhook is not in `routes-array.ts`.** It is mounted at `/webhook` in `app.ts:12`,
  above `express.json()`, because signature verification needs the raw body. Registering it under
  `/api/v1` would expose a second path whose body was already parsed, failing every signature
  check. The reasoning is at `routes-array.ts:33-37`.
- **`PATCH /orders/:orderId/status` and `DELETE /orders/:orderId` are gone.** With several sellers
  on one order there is no single status to set; fulfilment is per `VendorOrder`
  (`order.route.ts:10-14`).
- **`assertVendorOwnsProduct` returns 404, not 403.** Deliberate, so another store's ids stay
  unguessable (`src/helpers/vendor.ts`).
- **Every buyer-facing route guards all three roles.** A VENDOR is still a shopper. All 78
  `authGuard(...)` call sites were enumerated: there is no single-role `CUSTOMER` guard and no
  zero-arg `authGuard()` anywhere. The `CLAUDE.md` rule is currently satisfied.
- **`discount` is informational.** `priceAtPurchase` is already discounted; subtracting `discount`
  from a total double-counts it.
- **`VendorOrder.commissionRate` is a snapshot**, so changing a store's rate never rewrites past
  orders.
- **The gateway call sits outside the refund transaction.** Never call a payment gateway from
  inside a DB transaction — a rollback after Stripe moved money would leave a refund at the
  gateway with no record here (`src/helpers/refund.ts`).
- **`processRefund` is called with `throwOnError: false`** on the automatic path. A committed
  cancellation must not be reported as failed because Stripe blinked; the failure lands on the
  Refund row and in the admin queue. An operator pressing retry *does* get the error.
- **`EnumUserRole.SUPER_ADMIN` exists only on the frontend.** No JWT will ever carry it; it is
  kept because existing admin checks reference it and treating it as an admin costs nothing.
- **Checkout math is duplicated on purpose.** The frontend copy is display-only; this side
  recomputes from DB prices and never trusts client-supplied amounts.

---

## Corrections made to existing docs during this audit

- `backend/CLAUDE.md` said three `.env.example` keys are unread. There are **four** —
  `DISCOUNT_RATE` (`.env.example:46`) is also read by nothing.
- The root `CLAUDE.md` documented the backend port as `5000`; `.env`, `.env.example` and
  `pnpm stripe:listen` all use `5001` (XR-01).
- The root `CLAUDE.md` said `TAX_RATE` defaults to `0.08` as though that were the intended value;
  it is a code fallback that disagrees with `.env.example` (XR-01).
