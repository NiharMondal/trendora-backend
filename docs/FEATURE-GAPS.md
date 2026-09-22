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
| ~~BE-02~~ | ~~IDOR — any user can read/edit/delete any address~~ | ✅ **FIXED** 2026-09-22 | — | security |
| ~~BE-03~~ | ~~IDOR — any user can read/delete any wishlist row~~ | ✅ **FIXED** 2026-09-22 | — | security |
| BE-04 | `POST /cloudinary/delete-temp` is unauthenticated | P2 | S | security |
| BE-41 | A failed temp promotion leaves a live image publicly deletable | P1 | M | media |
| BE-42 | The unsigned Cloudinary preset is an open upload endpoint | P1 | M | media |
| ~~BE-05~~ | ~~No rate limiting, helmet, body cap or request logging~~ | ✅ **FIXED** 2026-09-22 | — | security |
| BE-06 | `globalErrorHandler` returns the thrown object to the client | P0 | S | security |
| ~~BE-07~~ | ~~`authGuard` trusts the role in the JWT, not the DB~~ | ✅ **FIXED** 2026-09-22 | — | security |
| ~~BE-08~~ | ~~`PATCH /users/my-profile-update` has no validation~~ | ✅ **FIXED** 2026-09-22 | — | security |
| ~~BE-09~~ | ~~A customer cannot cancel their own order~~ | ✅ **FIXED** 2026-09-22 | — | orders |
| ~~BE-10~~ | ~~Wishlist duplicate check ignores `userId`~~ | ✅ **FIXED** 2026-09-22 | — | wishlist |
| ~~BE-11~~ | ~~Nothing schedules the refund / checkout sweeps~~ | ✅ **FIXED** 2026-09-22 | — | refunds |
| ~~BE-12~~ | ~~No transactional email beyond password reset~~ | ✅ **FIXED** 2026-09-22 | — | notifications |
| ~~BE-13~~ | ~~`OrderStatusHistory` is written and never read~~ — **premise was wrong**; it leaked instead | ✅ **FIXED** 2026-09-22 | — | privacy |
| ~~BE-14~~ | ~~`sortBy` is never validated against a column allowlist~~ | ✅ **FIXED** 2026-09-22 | — | query |
| ~~BE-15~~ | ~~Four list endpoints have no pagination~~ | ✅ **FIXED** 2026-09-22 | — | query |
| ~~BE-16~~ | ~~`GET /slides` ignores its own `isActive` / `sortOrder`~~ | ✅ **FIXED** 2026-09-22 | — | content |
| ~~BE-17~~ | ~~No health check endpoint~~ | ✅ **FIXED** 2026-09-22 | — | ops |
| ~~BE-18~~ | ~~No graceful shutdown; server lies about the DB~~ | ✅ **FIXED** 2026-09-22 | — | ops |
| ~~BE-19~~ | ~~No env validation at boot~~ | ✅ **FIXED** 2026-09-22 | — | ops |
| ~~BE-20~~ | ~~`GET /users` returns no email, role or pagination meta~~ | ✅ **FIXED** 2026-09-22 | — | users |
| ~~BE-21~~ | ~~Brand validation silently drops `logo`~~ | ✅ **FIXED** 2026-09-22 | — | catalogue |
| BE-22 | No test runner, no CI, no Dockerfile | P1 | L | ops |
| ~~BE-40~~ | ~~`POST /auth/register` returns the bcrypt password hash~~ | ✅ **FIXED** 2026-09-22 | — | security |
| ~~BE-23~~ | ~~SSLCommerz is dead dependency + dead config~~ | ✅ **FIXED** 2026-09-22 | — | cleanup |
| ~~BE-24~~ | ~~Six exported helpers have zero callers~~ | ✅ **FIXED** 2026-09-22 | — | cleanup |
| ~~BE-25~~ | ~~Unreachable enum values~~ — **premise partly wrong**; the mirror was the real gap | ✅ **FIXED** 2026-09-22 | — | cleanup |
| ~~BE-26~~ | ~~`variant`/`image`/`cloudinary` modules are half-built~~ | ✅ **FIXED** 2026-09-22 | — | structure |
| BE-27 | `PrismaQueryBuilder` is entirely `any`-typed | P2 | M | types |
| ~~BE-28~~ | ~~No `Payment` read endpoint~~ — building it surfaced a gateway-blob leak | ✅ **FIXED** 2026-09-22 | — | payments |
| BE-29 | No coupons or promotions | P2 | L | marketplace |
| BE-30 | No returns / RMA workflow | P2 | L | marketplace |
| BE-31 | No shipping methods, zones or carrier integration | P2 | L | marketplace |
| BE-32 | No stock reservation; no low-stock alerting | P2 | M | inventory |
| BE-33 | No search facets or full-text index | P2 | L | catalogue |
| ~~BE-34~~ | ~~Admin user management is one read-only list~~ | ✅ **FIXED** 2026-09-22 | — | users |
| ~~BE-35~~ | ~~No vendor moderation audit log~~ | ✅ **FIXED** 2026-09-22 | — | marketplace |
| BE-36 | No support tickets, disputes or buyer↔vendor messaging | P2 | L | marketplace |
| BE-37 | Reporting is two hand-rolled dashboard endpoints | P2 | L | analytics |
| ~~BE-38~~ | ~~Flat platform tax rate only~~ — **per-category rates done**; jurisdiction / VAT ids deferred | ✅ **PARTIAL** 2026-09-22 | — | tax |
| ~~BE-39~~ | ~~Two `onDelete: SetNull` warnings on required columns~~ — **premise was wrong**; no column had to become optional | ✅ **FIXED** 2026-09-22 | — | schema |

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

### ~~BE-02~~ · IDOR — any user can read, edit or delete any address
**✅ FIXED — 2026-09-22 · security**

**Was:** `findById`, `updateData` and `deleteData` looked the row up by `id` alone and the
controller never passed `req.user.id`. Any signed-in account could read, overwrite or hard-delete
any other user's address — the names, phone numbers and street addresses of the whole customer
base. The delete was a hard `prisma.address.delete` despite `Address.isDeleted` existing and a
required `Order.shippingAddressId` pointing at the row.

**Now:** all three resolve through a single `findOwnedAddress(id, userId)` in
`src/modules/address/address.service.ts:20-30`, which filters on `id + userId + isDeleted: false`
and throws **404, not 403** — a 403 confirms the row exists, which is all an attacker needs to
enumerate. Same convention as `assertVendorOwnsProduct` in `src/helpers/vendor.ts:157-170`. The
controller passes `req.user.id` on each of the three
(`src/modules/address/address.controller.ts:42-72`).

`deleteData` is now a soft delete (`isDeleted: true`). A hard delete would have hit the required
`Order.shippingAddressId` FK; order history is unaffected either way because `persistOrder` already
snapshots the address into `Order.shippingSnapshot`
(`src/helpers/create-order.ts:54-62`) precisely so a later edit or delete cannot rewrite what an
order was shipped to.

Two consequences of soft-delete that were handled in the same change:
- `findAllFromDB` (the admin list) now filters `isDeleted: false`, or deleting an address would
  have started surfacing it there.
- `updateData` is typed `TAddressValues` rather than `Partial<Address>`, so the payload provably
  cannot carry `userId` or `isDeleted` — an address cannot be reassigned to another account or
  undeleted through the route.

Also removed a dead duplicate `findMany` in `findMyAddress` (it ran the same query twice and
discarded the first result).

**Verified** with two real accounts against the dev database: user 2 GET/PATCH/DELETE on user 1's
address id all return **404**, the row is unchanged afterwards, and the owner's own GET/PATCH still
return 200. Unauthenticated returns 401. After the owner deletes: the row vanishes from
`/address/my-address`, GET/PATCH/DELETE on it return 404, and the row is still in the database with
`isDeleted=true` — soft, not hard. The admin list returns no soft-deleted rows.

**Deliberate behaviour change:** `/address/:id` is now self-scoped for **every** role, including
ADMIN — an admin reading another user's address there gets 404. Unlike a review, an address has no
moderation use case, and an admin who needs the address for an order should read that order's
`shippingSnapshot`, which is the correct source anyway (it is the address *as of* that order). The
admin-only `GET /address` list is untouched and still available for a future admin screen.

**Still open, unchanged by this fix:**
- `GET /address` is still unpaginated and returns every customer's address in one response — BE-15.
- `Address.isDefault` is accepted by the validation schema and read by **nothing**. Nothing enforces
  a single default per user, and deleting the default promotes no replacement. Worth its own item
  if a default-address UI is ever built.

---

### ~~BE-03~~ · IDOR — any user can read or delete any wishlist row
**✅ FIXED — 2026-09-22 · security**

**Was:** `findById` and `deleteData` used the raw `id` and the controller never passed the caller,
so any signed-in account could read or delete items out of anyone else's wishlist.

**Now:** both resolve through `findOwnedWishlist(id, userId)`
(`src/modules/wishlist/wishlist.service.ts:17-27`), which filters on `id + userId` and throws
**404, not 403** — the same convention as `findOwnedAddress` (BE-02) and
`assertVendorOwnsProduct`. The controller passes `req.user.id`
(`src/modules/wishlist/wishlist.controller.ts:32,43`).

The delete stays **hard**, unlike the address case: `Wishlist` has no `isDeleted` column and
nothing references the row, so there is no history to preserve.

**BE-10 was fixed in the same pass** — same file, same oversight. See its entry.

**Also closed here:** `POST /wishlists` had no `validateRequest`, and could not simply be given one.
The schema required `userId` in the body, which the frontend has never sent, so wiring it up as-is
would have 400'd every request. `createWishList` now validates **only `productId`**
(`src/modules/wishlist/wishlist.validation.ts:12-14`) and the route applies it
(`src/modules/wishlist/wishlist.route.ts:24-29`). The owner comes from the verified JWT and is
never accepted from the body.

**Verified** with two real accounts against the dev database: user 2 GET and DELETE on user 1's
wishlist row both return **404** and the row survives; the owner's GET returns 200; deleting twice
returns 200 then 404; unauthenticated returns 401. A POST carrying another user's `userId` in the
body creates the row for **the caller**, not the named user. A POST with a missing or non-UUID
`productId` now returns a 400 validation error instead of reaching Prisma.

**Still open:** `GET /wishlists/my-wishlist` remains unpaginated (BE-15), and `createIntoDB` checks
only `product.isDeleted` — a shopper can still wishlist a DRAFT, PENDING or REJECTED listing, or
one from a suspended store, because it does not compose `publicProductFilter`
(`src/helpers/vendor.ts`). Low impact (the storefront will not render it), but it is the same
visibility rule every other read applies.

---

### ~~BE-05~~ · No rate limiting, helmet, body-size cap or request logging
**✅ FIXED — 2026-09-22 · security**

**Was:** `src/app.ts` was the Stripe webhook, a bare `express.json()` and `cors`. No throttling on
`/auth/login` or `/auth/forgot-password`, no security headers, no body cap, and no request log to
investigate an incident with.

**Now:** the stack in `src/app.ts` is, in order — and the order is load-bearing:

| # | Middleware | Why it sits there |
| --- | --- | --- |
| 1 | `trust proxy` (only when `TRUST_PROXY > 0`) | per-IP limits need the real client address |
| 2 | `helmet({ contentSecurityPolicy: false })` | CSP governs what a *document* may load; this process serves only JSON |
| 3 | `cors` | **must precede the limiter** — a 429 is still cross-origin, and without these headers the browser reports an opaque CORS failure instead of the real message |
| 4 | `morgan` | above everything it should see, including the webhook and rejected requests |
| 5 | `/webhook` | unchanged: above `express.json()` for raw bytes, and **deliberately above the limiter** so Stripe retries are never throttled |
| 6 | `express.json({ limit })` | body cap, default `1mb` |
| 7 | `apiLimiter` + `/api/v1` | scoped to the API so the webhook stays exempt |

Limiters live in `src/middleware/rateLimiter.ts`, all per-IP over a 15-minute window:

- **`apiLimiter`** — 1000 req, whole API. Generous on purpose: this stops scraping and floods, it
  is not there to shape normal browsing.
- **`loginLimiter`** — 10, with `skipSuccessfulRequests`. Only **failed** attempts count, so a real
  user is never locked out by their own logins while credential stuffing burns the budget in
  seconds.
- **`sensitiveAuthLimiter`** — 10, counting every request, on `/register`, `/forgot-password` and
  `/reset-password`, where a *successful* call is itself the cost. This is the IP-level counterpart
  to the per-account cooldown in `forgotPassword` (BE-01): that stops one address being mail-bombed,
  this stops one client walking a list of addresses.

**Applied per endpoint, not to the whole auth router.** `/refresh-token` is called by every
signed-in browser roughly every 20 minutes and `/oauth-login` on every Google sign-in; throttling
those at credential-guessing rates would break sessions for everyone behind one NAT. Only actual
attack surface is limited — see the note in `src/modules/auth/auth.route.ts`.

All budgets, the body cap and `TRUST_PROXY` are env-tunable (`.env.example` → `# security`).

**Verified** against the running server:
- Headers present (`Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Cross-Origin-*`) plus `RateLimit-Policy` / `RateLimit`.
- **12 consecutive successful logins all returned 200** and consumed no budget; failed logins then
  tripped 429 on schedule. The 429 carries `Access-Control-Allow-Origin` and the standard
  `{ success:false, message, errorDetails }` envelope.
- `/forgot-password` blocked at 11; `/register` shares that budget; `/login` and `/refresh-token`
  have their own and were unaffected; general API traffic unaffected.
- 2 MB body → **413 "request entity too large"**; normal bodies unaffected.
- `POST /webhook` reachable, carries **no** `RateLimit` header, and still fails signature
  verification correctly — proof it is still receiving raw bytes.
- Full smoke test (register, login, profile, products, categories, slides, vendors, address CRUD,
  wishlist CRUD, 404, 401) all green.

**Still open:** the limiter uses the default **in-memory store**, so budgets are per-process and
reset on restart. Fine for one instance; behind more than one you need a shared store (Redis) or
each instance enforces its own budget. `TRUST_PROXY` must be set correctly before deploying behind
a load balancer — too low and one noisy client throttles everyone, too high and `X-Forwarded-For`
can be spoofed to dodge the limit.

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

### ~~BE-07~~ · `authGuard` trusts the role in the JWT rather than the database
**✅ FIXED — 2026-09-22 · security**

**Was:** the guard destructured `role` out of the decoded token and authorized against it — after
already loading the `User` row with `auth` included. It did the query, then ignored the
authoritative answer it came back with.

**This was worse than a stale-routing bug.** `req.user` was set to the decoded token, so the stale
`role` claim propagated into `resolveVendorScope` and `vendorListScope`
(`src/helpers/vendor.ts:108,143`), where `ADMIN` means *may act on any store* and returns an
unrestricted product filter. A demoted admin kept **write scope over every vendor's catalogue** for
the rest of the token's 20-minute life, not just access to admin routes.

It failed in the other direction too: approving a seller flips `Auth.role` to `VENDOR`
(`src/modules/vendor/vendor.service.ts:337-341`), but the old token knew nothing about it, so a
newly approved vendor was locked out of their own dashboard until the token refreshed.

**Now:** `src/middleware/authGuard.ts` authorizes against `user.auth.role`, and sets
`req.user = { ...decodeToken, role: currentRole }` so every downstream decision sees the same role
the guard enforced. Costs nothing — the row was already being loaded.

Two smaller corrections in the same function:
- `findUniqueOrThrow` → `findUnique` + an explicit 401. A token naming a deleted user is an
  authentication failure; letting Prisma raise `P2025` surfaced it as a **400** through the global
  handler, and the existing `if (!user)` check was unreachable dead code.
- `User.auth` is optional in the schema, so a `null` auth row is now an explicit 401 rather than a
  `TypeError`.

**Verified** against the dev database with a real token whose claim was deliberately made stale:
- **Promotion is instant** — DB role set to ADMIN, the *old CUSTOMER-claim* token immediately
  reached `GET /users` and `GET /orders` (200) with no re-login.
- **Demotion is instant** — a token minted while ADMIN, then demoted in the DB, got **403** on
  `/users` and `/vendors/admin/all`.
- **The propagation test:** with an ADMIN-claim token and DB role `VENDOR`,
  `GET /products/vendor/my-products` was scoped as a vendor ("You do not have a vendor account"),
  **not** given the unrestricted admin filter — proving `req.user.role` reaches
  `vendorListScope`.
- Unknown user id → 401 (was 400); user row with no `Auth` → 401.
- Regression across all three seeded roles: ADMIN reaches its four admin routes; VENDOR reaches
  its store routes and is 403 on `/users`; CUSTOMER reaches wishlist/address/orders and is 403 on
  `/users`; a VENDOR still reaches `/orders/my-orders` as a shopper.

**Note:** `req.user.email` is still whatever the token carried. There is no email-change endpoint
today, so it cannot go stale — revisit if one is ever added.

---

### ~~BE-08~~ · `PATCH /users/my-profile-update` has no `validateRequest`
**✅ FIXED — 2026-09-22 · security**

**Was:** the route wired the controller directly. `userUpdateSchema` existed and the service even
imported its inferred type, but the middleware was never applied — the only unvalidated write route
in the repo.

Measured before the fix:

| Request | Result |
| --- | --- |
| `{}` (empty body) | **200 "Information updated successfully"** — a no-op reported as success |
| `name` as a number | 400, but leaking a raw `PrismaClientValidationError` |
| `avatar.publicId` as a number | **500 `tempPublicId.includes is not a function`** |
| unknown fields (`isDeleted`, `role`, `id`) | 200 |

**Now:** `validateRequest(userUpdateSchema)` is applied (`src/modules/user/user.route.ts:10-15`).
All four cases above return a clean 400 with field-level messages, except the last, where Zod
strips the unknown keys.

**`name` was relaxed from `min(5)` to `min(1)`** — this was XR-06's open question, and the backend
is the side that was wrong. Registration accepts any non-empty name
(`authSchema.registerUser`), so `min(5)` would have locked anyone who signed up as "Li" or "Ann"
out of their own profile permanently. Plenty of real names are shorter than five characters. It now
matches both registration and the frontend's `profileFormSchema`. `.trim()` runs before `.min(1)`,
so a whitespace-only name is rejected rather than stored blank.

**Mass assignment was never possible here** — `updateData` builds an explicit `transformData`
projection (`src/modules/user/user.service.ts:36-41`), so extra body keys were already ignored.
Verified: sending `isDeleted: true`, `role: "ADMIN"` and `id: "hacked"` left all three untouched.
Validation now rejects them one layer earlier rather than relying on that projection staying
correct.

**Verified** against the dev database: empty body, whitespace-only name, non-string `name`,
non-string `avatar.publicId` and missing `phone` all return 400 with per-field messages; `"Li"`
is accepted; a valid update round-trips through `GET /users/my-profile` with the name trimmed;
`avatar` omitted entirely is accepted (it is optional). The seeded customer record used for the
probes was restored afterwards.

**Still open:** this is a full replace, not a partial patch — `name` and `phone` are both required,
which is what the profile form always sends, but the verb is `PATCH`. Also `User.phone` is
`@unique`, so two accounts claiming the same number surface as a generic "Duplicate key error"
rather than a field-level message.

---

## P1 — a user or operator hits this

### ~~BE-09~~ · A customer cannot cancel their own order
**✅ FIXED — 2026-09-22 · orders**

**Was:** the route was guarded `VENDOR, ADMIN`, and the service did
`if (actor.role !== Role.ADMIN) requireApprovedVendor(actor.id)`. A buyer had no cancel route at
all — and neither did a **VENDOR acting as a shopper**, since that call pinned them to their own
store's parcels.

**Now:** the route accepts `CUSTOMER, VENDOR, ADMIN`, and the service resolves **capacity, not
role** — `resolveOrderActorCapacity` asks "what is this caller to *this parcel*?" and returns
`admin`, `seller` or `buyer`. That distinction is the point: role alone cannot answer it, because
the same account is a seller on its own store's parcels and a buyer on parcels it ordered
elsewhere.

Each capacity gets its own transition table (`src/helpers/allowedTransition.ts`):

| capacity | may do |
| --- | --- |
| `admin` | anything the state machine allows, including cancelling a SHIPPED parcel |
| `seller` | move forward; cancel while nothing has shipped (unchanged) |
| `buyer` | **`PENDING → CANCELED`, and nothing else** |

**The gate is `OrderStatus`, never `PaymentStatus`.** This was the open design question, and the
payment-status half of it is a trap: a cash-on-delivery order stays `paymentStatus: PENDING` right
up until every parcel is delivered (`reconcilePayment`), so "allow cancel while payment is pending"
would let a buyer cancel a parcel that had already **shipped**. Verified directly — a COD parcel
sitting at `parcel=SHIPPED payment=PENDING` is correctly refused. Payment status decides what
*happens* on cancel (whether `recordRefundIntent` owes money back), not whether cancel is allowed.

Why `PENDING` only and not `PROCESSING`: once the seller has accepted and started packing, calling
it off stops being a unilateral decision and becomes a request. The buyer gets an actionable 403
naming the current status and telling them to contact the seller, rather than a bare "forbidden".
Widening to `PROCESSING` is a one-line change to `buyerAllowedTransitions` if the window proves too
tight in practice.

Smaller points handled in the same change:
- Shipping details are ignored when the caller is a buyer — no setting `trackingNumber` or
  `carrier` by attaching them to a cancel.
- `cancelReason` defaults to "Canceled by customer" / "Canceled by seller" / "Canceled by admin"
  instead of always "Canceled by seller".
- `requireApprovedVendor`'s precise pending/rejected/suspended errors are preserved: a caller who
  owns the selling store still goes through it, so a suspended seller gets that message rather than
  falling through to a 404.
- A caller who is neither buyer nor seller of the parcel gets **404, not 403**, so order ids stay
  unguessable.

**Verified** end to end against the dev database with real COD orders:
- Buyer cancels a PENDING parcel → 200; stock returned (297 → 299); `cancelReason` reads
  "Canceled by customer".
- Buyer → `PROCESSING` / `SHIPPED` → 403 / 400. Buyer → CANCELED after the seller moved it to
  PROCESSING → 403 with the "contact the seller" message.
- **Buyer → CANCELED on a SHIPPED COD parcel (`payment=PENDING`) → 403.** The case the
  payment-status rule would have allowed.
- A **VENDOR cancelling their own purchase** from another store → 200. Previously impossible.
- An unrelated vendor targeting the parcel → 404.
- Seller → CANCELED on SHIPPED still 403; **admin** → 200, so the override is intact.
- `OrderStatusHistory` records the acting user and reason on every hop.
- All test orders removed afterwards; product stock back to its original 300.

**Note:** cancellation is per **parcel**, matching the architecture — `Order.orderStatus` is a
derived rollup. A buyer with a two-store cart cancels each parcel separately; there is deliberately
no whole-order cancel endpoint.

---

### ~~BE-10~~ · Wishlist duplicate check ignores `userId`
**✅ FIXED — 2026-09-22 · wishlist**

**Was:** the guard was `findFirst({ where: { productId } })` with no `userId`, so once *any* user
wishlisted a product, **every other user** got `400 "Sorry, This product already exist"` for it.
Popular products became un-wishlistable platform-wide.

**Now:** the check reads through the model's own `@@unique([userId, productId])` index —
`findUnique({ where: { userId_productId: { userId, productId } } })`
(`src/modules/wishlist/wishlist.service.ts:54-58`) — so it is a single keyed lookup scoped to the
caller. That constraint is also the backstop for the race where two concurrent requests both pass
the check: the loser surfaces as a `P2002`, which `globalErrorHandler` already maps.

**Verified:** two different users can now wishlist the same product (both 201), while the same user
adding the same product twice still gets the 400.

---

### ~~BE-11~~ · Nothing schedules the refund and checkout sweeps
**✅ FIXED — 2026-09-22 · refunds**

**Was:** `processPendingRefunds` was reachable only from the manual
`POST /refunds/retry-all`; `expireStaleCheckoutSessions` had zero callers; and a refund stuck in
`PROCESSING` was never polled at all. No scheduler of any kind existed.

**Now:** `src/scheduler/index.ts` runs three sweeps via `node-cron`, started from `server.ts` after
the port is open (so a slow first sweep cannot delay the listen and fail a container health check).

| job | cadence | why that cadence |
| --- | --- | --- |
| `process-pending-refunds` | every 10 min | a FAILED refund is a buyer who has not been paid back — retry promptly, but not so fast that a persistently failing refund hammers Stripe |
| `reconcile-processing-refunds` | every 30 min | only needed when a `refund.updated` webhook was missed; read-only against Stripe, so a slow cadence costs only a little delay |
| `expire-stale-checkout-sessions` | hourly | pure housekeeping — `consumeCheckoutSession` already refuses anything not PENDING |

Three properties hold the design up, and each is tested:

1. **A job never overlaps itself.** A sweep that outruns its interval is skipped rather than
   re-entered — two copies of `processPendingRefunds` would attempt the same refund twice.
2. **A job never crashes the process.** Every run is wrapped; an unhandled rejection in a timer
   callback would take the server down.
3. **It is per-instance.** The scheduler is in-process, so every instance with it enabled runs
   every sweep. The jobs tolerate that (gateway calls are idempotency-keyed, sweeps are
   `updateMany`) but it is duplicated work — set `SCHEDULER_ENABLED=false` on all but one instance.

**New: `reconcileProcessingRefunds`** (`src/helpers/refund.ts`). `processPendingRefunds`
deliberately retries only PENDING and FAILED; a PROCESSING refund is already in flight and
re-sending it would be a second refund attempt. This one is **read-only against Stripe**
(`retrieveStripeRefund`) so it can never move money — it settles the row from the gateway's view.
A refund that cannot be reached is logged and counted, and the sweep continues to the next.

While wiring it, the Stripe-status mapping was extracted to `mapStripeRefundStatus` and the webhook
now shares it, so the webhook and the sweep cannot drift on what "canceled" means. (It maps to
FAILED, not `RefundStatus.CANCELED`: our CANCELED means an operator abandoned the refund and no
money moved, whereas a gateway-cancelled refund is money that was owed and did not arrive.)

**Verified** against the dev database:
- **Checkout sweep does real work** — a draft with `expiresAt` in the past flipped PENDING →
  EXPIRED (`count: 1`) while a live draft was left alone; a second run was a no-op (`count: 0`).
- **Refund sweeps contain failures** — a seeded FAILED refund was attempted and stayed FAILED
  (`attempted: 1, failed: 1`); a PROCESSING refund pointing at a nonexistent Stripe id logged
  `No such refund` and returned `checked: 1, errored: 1`. Neither crashed, and neither moved money
  (both referenced Stripe objects that do not exist).
- **Overlap guard** — firing the same job twice concurrently logged
  `is still running from the last tick — skipping` and ran it once.
- **`SCHEDULER_ENABLED=false`** starts nothing; `stopScheduler()` stops every task cleanly.
- All probe data removed afterwards.

**Still open:** `stopScheduler()` exists but nothing calls it, because there is no shutdown
handler yet — that is **BE-18**. Until then a deploy can kill a sweep mid-flight, which is safe
(every job is idempotent and re-runs on the next tick) but not tidy.

---

### ~~BE-12~~ · No transactional email beyond password reset
**✅ FIXED — 2026-09-22 · notifications**

**Was:** the transport existed (from BE-01) but only the two password templates used it. No order
confirmation, no shipping notice, no refund confirmation, no vendor decision, no payout notice — a
seller learned about a new order only by opening the dashboard.

**Now:** six more templates in `src/utils/email-templates.ts`, wired through a new
`src/helpers/notifications.ts`:

| event | who is told | hook point |
| --- | --- | --- |
| Order placed | buyer (whole order) **and** each seller (their parcel only) | `createCODOrder`, and the Stripe webhook after `persistOrder` |
| Parcel SHIPPED / DELIVERED / CANCELED | buyer | `updateVendorOrderStatus` |
| Refund SUCCEEDED | buyer | `updateVendorOrderStatus`, after `processRefund` |
| Store approved / rejected | store owner | `approveVendor` / `rejectVendor` |
| Payout marked paid | store owner | `markPaid` |

**`notifications.ts` exists so services stay clean.** Each service calls one function with an id;
that module does the reading, picks the template and sends. Two rules hold it together, and both
are enforced in one place rather than remembered at five call sites:

1. **Never throw.** Every function is wrapped in `notify()`, which turns any failure into a log
   line. An order that is already committed is not un-placed because a confirmation email bounced.
2. **Never call from inside a `$transaction`.** These read from the database and talk to SMTP;
   doing that inside a transaction holds it open across network round trips. Every hook point is
   *after* the commit — the same reasoning that keeps the gateway call out of the refund
   transaction.

Judgement calls worth knowing:
- **`PROCESSING` sends nothing.** Only SHIPPED, DELIVERED and CANCELED reach the buyer; mailing an
  internal step is noise.
- **A cancellation only promises a refund when one exists.** `refundExpected` is driven by whether
  a `Refund` row was actually created, so a cancelled COD or unpaid parcel does not tell the buyer
  money is coming when it is not.
- **Sellers see their own parcel only**, never the whole order.
- Money is formatted USD, matching the storefront's hardcoded `currencyFormatter`. If
  multi-currency ever lands, `money()` in `email-templates.ts` is one of the places that must learn
  about it.

**Verified** against the dev database, with SMTP deliberately unconfigured so every send was logged
instead of delivered:
- A real COD order produced exactly two messages — `"Trendora order ORD-… confirmed"` to
  `customer@trendora.test` and `"New order for Urban Threads — ORD-…-V01"` to
  `vendor1@trendora.test`.
- The same parcel at `PENDING` sent **nothing**; forced to `SHIPPED` it sent
  `"Your parcel is on its way"` with the tracking number and carrier.
- Store approve and reject sent the right subjects to the owner.
- A missing payout and a missing refund were silent no-ops; a bogus order id did not throw.
- Every template was rendered and read end to end, which caught a real formatting bug: a
  `.filter(Boolean)` intended to drop an optional trailing note was stripping **every** blank line
  from the plain-text bodies. Fixed in four templates by spreading optional pieces conditionally.
- Probe order removed afterwards and product stock restored to 300.

**Still open:** there is no *in-app* notification model — nothing is persisted, so a user who
misses an email has no second channel. Low-stock alerts to sellers and an order-confirmation to
guests (there is no guest checkout yet) are the obvious next additions.

---

### ~~BE-13~~ · `OrderStatusHistory` — the audit was wrong, and the real bug was a leak
**✅ FIXED — 2026-09-22 · privacy**

**Correction first.** This item claimed the table was "written once, never read, no endpoint
surfaces it". **That was wrong.** `statusHistory` was already included in two reads —
`getOrderById` and `getVendorOrderById` — and had been since commit `0ca4501`, before this audit
was written. The original sweep grepped for `prisma.orderStatusHistory`, which only matches the
*write*; the reads use the Prisma **relation field name**, so they were invisible to that search.
The frontend even carries a `TVendorOrderStatusHistory` type for it.

**The actual defect was the opposite of the one recorded: it was over-exposed.** Both includes were
bare `statusHistory: { orderBy: … }` with no `select`, so the whole row went out — including
`ipAddress` and the acting `userId`. Both endpoints are reachable by the **buyer and by any vendor
holding a slice** of that order, which meant:

- a seller could read the **buyer's IP address**, logged when the order was placed, off their own
  parcel's trail;
- a buyer could read the IP of the seller or admin who moved their parcel;
- both got raw `userId`s they had no use for.

Confirmed against a real order before the fix — a vendor's `GET /orders/:id` returned
`"ipAddress": "::1", "userId": "4d6da573-…"` on the buyer's own order-placed event.

**Now:** `statusHistorySelect` projects the rows, and `sanitizeStatusHistory(history, isAdmin)`
narrows them per caller at each authorization branch:

| caller | sees |
| --- | --- |
| buyer, seller | `id`, `oldStatus`, `newStatus`, `note`, `createdAt` — the timeline, nothing else |
| ADMIN | the above plus `ipAddress` and a named `actor` |

A buyer does not need the seller's personal name (the store name is already on the parcel), a
seller does not need the buyer's, and an IP address exists for abuse investigation — an admin
activity. Admins additionally gained something they did not have before: the actor is now a
`{ id, name }` rather than a bare uuid, which is what makes the trail usable as an audit log.

**Verified** against the dev database with a real COD order moved PENDING → PROCESSING:
- Buyer and seller both get the four timeline fields and **no `ipAddress`**, on
  `GET /orders/:orderId` **and** `GET /orders/vendor/my-orders/:id`.
- ADMIN gets `ipAddress` plus `actor: { id, name }` — "Test Customer" placed it, "Ayesha Rahman"
  moved it — on both endpoints.
- Probe order removed afterwards; history table back to 0 rows, stock restored to 300.

**Still open:** nothing *renders* the trail. The frontend has the type and now receives the data on
order detail, but no screen shows a timeline — that is a frontend item, and the natural companion
to FE-38 (order tracking).

**Process note:** the same grep blind spot — searching for `prisma.<model>` when the access is via
a relation include — could hide other "never read" claims in this document. `OAuthAccount` and
`CheckoutSession` were assessed the same way and are worth re-checking before acting on them.

---

### ~~BE-14~~ · `sortBy` is never validated against a column allowlist
**✅ FIXED — 2026-09-22 · query**

**Correction to this entry:** it said an unknown sort field "produces a Prisma 500". **It did not.**
Prisma throws `PrismaClientValidationError`, which `globalErrorHandler` already maps to **400** —
but with `message: "PrismaClientValidationError"` and `errorDetails: null`, which tells the caller
nothing. So the bug was a useless error, not a crash. Verified by calling Prisma directly with a
bogus `orderBy`.

**Was:** `PrismaQueryBuilder` supported `allowedFields` and **not one of the 19 construction sites
passed it**, so `sortBy` went from the query string into Prisma's `orderBy` unchecked.

**Now:** the builder derives the allowlist from the schema itself. `ModelConfig.model` is
**required**, so the compiler rejects any new list endpoint that skips the check — that is the part
that stops this regressing. It cannot be inferred, because the generic
(`Prisma.ProductWhereInput`) is erased at runtime.

```ts
const builder = new PrismaQueryBuilder<Prisma.ProductWhereInput>(query, {
    model: "Product",
});
```

`sortableFieldsFor(model)` reads `Prisma.dmmf` for that model's scalar and enum fields and caches
the set. **Derived rather than hand-listed on purpose:** a hand-maintained allowlist goes stale the
first time someone adds a column, and its failure mode is rejecting a field that legitimately
exists. An explicit `allowedFields` still wins where a service wants to narrow further.

An unknown field now throws a **400 naming the field and listing every sortable one**, rather than
the builder's previous behaviour of silently falling back to the default — which returned a
differently-ordered page with no hint why.

```
GET /products?sortBy=nonsense:asc
400  Cannot sort by "nonsense". Sortable fields: approvedAt, averageRating, basePrice, brandId, …
```

**Verified** against the running server:
- Valid sorts still work and **actually order the rows** — `basePrice:asc` returned
  `15.99, 29.99, 49.99, 89` and `basePrice:desc` returned `190, 150, 93.99, 90.99`.
- `createdAt`, `name`, `basePrice`, `rating` (the four the frontend offers) all pass on their
  respective models; omitting `sortBy` still uses the default.
- Rejected with a 400 and a useful message: an invented column, a column from the wrong model
  (`basePrice` on `/brands`), and a **relation** name (`vendor` on `/reviews`) — relations are
  excluded from the derived set because they are not sortable scalars.
- All 19 sites were machine-checked: every declared `model` matches its `Prisma.<X>WhereInput`
  generic.

**~~Still open~~ — settled by BE-20 (same day).** This section was written before BE-15 put
`GET /users` through the builder, at which point `?sortBy=email:asc` started returning a real
`400 Cannot sort by "email"` — `email` is a column of `Auth`, not `User`, so the DMMF-derived
allowlist could never contain it. Rather than delete the frontend's Email sort option, **BE-20
taught the builder about declared relation aliases**, so `email` and `role` are now genuinely
sortable on that endpoint. See **XR-08**.

---

### ~~BE-15~~ · Four list endpoints have no pagination
**✅ FIXED — 2026-09-22 · query**

All four now route through `PrismaQueryBuilder` and return `meta`. **They were not the same case**,
and the default limit differs on purpose:

| endpoint | why it needed it | default limit |
| --- | --- | --- |
| `GET /users` | admin list of the **entire user base** — unbounded | 10 |
| `GET /address` | admin list of **every customer's address** — unbounded, and PII | 10 |
| `GET /slides` | was a hardcoded `take: 4` that **ignored the caller's `limit` entirely** | 10 |
| `GET /wishlists/my-wishlist` | already scoped to one person, so never unbounded — but nothing caps how many products someone wishlists | **100** |

**The wishlist default is 100, not 10, and that is the interesting decision.** The storefront calls
`useMyWishlistQuery()` with **no pagination params**, so the standard default of 10 would have
silently shown a shopper only the first ten items of their own wishlist — a data-loss bug dressed
up as a fix. 100 gives a client that asks real pagination while truncating nobody in practice. Drop
it to the standard default once the frontend pages properly.

Also fixed while routing them through the builder:
- `GET /users` now excludes soft-deleted users (it returned them) and supports `?search=` on name
  and phone.
- `GET /slides` now excludes soft-deleted slides and **honours `?limit=`** — the hero slider has
  been asking for 5 and silently receiving 4.
- `Slide` has no relations at all, so Prisma's `findMany` args have no `include` key; the builder's
  is destructured away at that one call site.

**Verified** against the dev database:
- `/users`: 8 rows default, `?limit=3` → 3 with `totalPages: 3`, `?page=2&limit=3` → the second
  page, `?search=Ayesha` → 1.
- `/slides`: `?limit=5` now returns what was asked for with `pageSize: 5`; `?limit=2` pages
  correctly with `hasNextPage: true`.
- `/address`: paginates with `meta`.
- **Wishlist truncation proved rather than assumed** — with 14 items seeded, no params returned all
  14 (`pageSize: 100`), while `?limit=10` returned 10 and hid 4. That is exactly the bug a default
  of 10 would have shipped.
- `result` is still a plain array on every one of them, so no frontend read breaks.
- Probe products and wishlist rows removed afterwards; database back to 9 products and the 2
  pre-existing wishlist rows.

**Now live from BE-14:** `GET /users?sortBy=email:asc` returns
`400 Cannot sort by "email"` — `email` is on `Auth`, not `User`. It was inert while this endpoint
bypassed the query builder; routing it through the builder has made the frontend's
`userSortOptions` Email entries a **real, user-visible error**. Removing those two options is now
the immediate frontend follow-up. See **XR-08**.

**Still open:** `GET /users` still does not return `email` or `role` — those live on `Auth` and need
an `include`. That half is **BE-20**; only the pagination half belonged here.

---

### ~~BE-16~~ · `GET /slides` ignores its own `isActive` and `sortOrder`
**✅ FIXED — 2026-09-22 · content**

**Was:** `isActive` and `sortOrder` existed on the model and were applied by nothing, so an
operator could neither hide nor reorder a hero slide. (The hardcoded `take: 4` and the missing
`isDeleted` filter were dealt with in BE-15.)

**Now:**
- **Ordered by `sortOrder` ascending** by default rather than `createdAt`. That column is the
  operator's chosen display order — it is the whole reason it exists. `?sortBy=` still overrides.
- **`isActive: true` is a hard filter on the public list**, not an overridable default. `GET /slides`
  has **no `authGuard`**, and the builder AND-s its default filter with query-param filters, so a
  soft default would have let `?isActive=false` hand anyone the banners an operator had
  deliberately taken down.

**That created a trap, so it comes with an admin listing.** With `isActive` hard-filtered,
deactivating a slide would make it unreachable — hidden from the public list with no other way to
find it again. `GET /slides/admin/all` (ADMIN) lists every non-deleted slide, active or not. This
is the same split the codebase already uses for `GET /products` vs `/products/admin/all`, and the
route is registered **above `/:id`** or Express matches `"admin"` as an id.

Both listings also gained `?search=` on title and subtitle.

**Verified** against the dev database, with the three seeded slides given a `sortOrder` that
deliberately **disagrees with `createdAt`** and one deactivated:
- Public list returned `Everyday basics(10) | Built to run(20)` — the *reverse* of creation order,
  which is what proves `sortOrder` is actually driving it rather than coinciding.
- `?sortBy=sortOrder:desc` flipped it.
- The deactivated slide was absent, and **`?isActive=false` returned nothing** — the public
  endpoint cannot be coaxed into revealing it.
- `GET /slides/admin/all` returned all three including the deactivated one; without a token it
  returns 401; and `/admin/all` is not swallowed by `/:id`.
- Slides restored to their seeded order afterwards.

**Related:** there is still no admin screen to manage slides (**FE-14**) — the API it needs now
exists, including the create/update/delete routes that were already there and the listing that was
missing.

---

### ~~BE-17~~ · No health check endpoint
**✅ FIXED — 2026-09-22 · ops**

`src/routes/health.route.ts`, mounted at `/health` in `app.ts` — **outside `/api/v1` and above the
rate limiter**, so an orchestrator polling it is never throttled into looking unhealthy.

Two probes, and the split matters:

| probe | checks | why |
| --- | --- | --- |
| `GET /health` | nothing external — process is up, plus uptime | Liveness decides whether to **restart** the container. Wiring it to the database would turn a brief DB blip into a restart loop across every instance, and restarting the app does not fix the database. |
| `GET /health/ready` | `SELECT 1` through Prisma | Readiness decides whether to **send requests**. An instance that cannot reach its database should leave the pool without being killed. Returns **503**, not 500 — "temporarily unable to serve" is what a load balancer needs to hear. |

The failure body carries the error *message* only, never the error object: this endpoint is
unauthenticated and a connection error carries the DSN.

**Verified:** `/health` → `{"status":"ok","uptimeSeconds":7}`; `/health/ready` →
`{"status":"ready","database":"up"}`; `/api/v1/health` → 404 (correctly not behind the prefix); no
`RateLimit` header on either; and both are **absent from the request log** — six probe hits
produced zero log lines while a real request was logged.

That last part needed a fix of its own: morgan's `skip` runs on the response's `finish` event, by
which point a mounted router has rewritten `req.path` to be relative to its mount point. It now
tests `req.originalUrl`, which is never rewritten.

---

### ~~BE-18~~ · No graceful shutdown, and the server lies about the database
**✅ FIXED — 2026-09-22 · ops**

**Was:** `app.listen` and two `console.log`s, one of which printed `"Database connected"`
**unconditionally, having never connected** — so a down database looked like a healthy boot.

**Now:** `src/server.ts` connects first and only logs once `prisma.$connect()` resolves; a failure
exits 1 with the real reason instead of pretending.

Shutdown runs in a deliberate order on SIGTERM/SIGINT:

1. **Stop the scheduler** — so no sweep starts while the process is closing. (`stopScheduler()` has
   existed since BE-11 with nothing calling it; this is that caller.)
2. **Close the HTTP server and drain** in-flight requests. Killing them mid-request can abort a
   transaction between the order write and the refund intent.
3. **Then** `prisma.$disconnect()`.

With a 10s force-exit timer (`unref`'d, kept under the 30s most orchestrators allow before
SIGKILL) so a hung keep-alive socket cannot hold the process past the orchestrator's patience, and
a re-entrancy guard so a second Ctrl-C does not start a second shutdown.

`unhandledRejection` and `uncaughtException` log and shut down with exit 1 — the process is in an
unknown state after either, and staying up risks serving requests from corrupted state.

**Verified:** SIGTERM produced `draining… → http server closed → database disconnected`, and the
port was closed afterwards.

---

### ~~BE-19~~ · No env validation at boot
**✅ FIXED — 2026-09-22 · ops**

`src/config/env-config.ts` now parses `process.env` through a Zod schema at import time and throws,
listing **every** problem at once rather than one per restart.

Three tiers, chosen deliberately rather than making everything required:

- **Required** — `DATABASE_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`. No safe default
  exists and silent failure is worst; a missing token secret used to be papered over with
  `as string` and surfaced as a confusing 500 on the first authenticated request.
- **Optional with a default** — every number and tunable, now **parsed and range-checked**. This is
  the part that catches real bugs: `TAX_RATE=abc` used to become `NaN` through an unguarded
  `parseFloat` and make every order's tax `NaN`. `TAX_RATE=5` (500%) is likewise refused.
- **Feature-gated** — Stripe, Cloudinary, SMTP. The code already degrades without them
  (`isEmailConfigured`, the scheduler's Stripe check), so a developer can still boot;
  `warnAboutDisabledFeatures()` prints exactly what is switched off at startup instead of leaving
  it to be discovered when a checkout silently fails.

Making `PLATFORM_COMMISSION_RATE` / `CHECKOUT_SESSION_TTL_MINUTES` / `SEED_PASSWORD` *required*
would have been the wrong reading of this item — the live `.env` omits all three and they have
sensible defaults. They are validated and defaulted instead.

**The convention is now actually true:** `grep process.env src/` returns nothing outside
`env-config.ts`. Two stragglers were fixed — `db.ts` (called out in this item) and
`helpers/notifications.ts`, which was introduced by BE-12.

**Verified:** a missing `ACCESS_TOKEN_SECRET`, `TAX_RATE=abc`, `TAX_RATE=5` and
`PLATFORM_COMMISSION_RATE=-1` each fail the boot with a message naming the variable and the rule;
two bad values are reported together; and with Stripe and SMTP blanked the process boots and logs
`running with these features DISABLED`.

Full regression after the rewrite: login, products, slides, users, orders, vendors, the Stripe
webhook signature check, both probes and an unauthenticated 401 all behave as before.

---

### ~~BE-20~~ · `GET /users` returns no email, role or pagination meta
**✅ FIXED — 2026-09-22 · users**

**Was:** `prisma.user.findMany()` with no `auth` include — and email and role live on `Auth`, not
`User` (`prisma/schema.prisma:49-59`) — so the admin user table rendered permanently blank Email
and Role columns. The `meta` half was already dealt with in BE-15.

**Now — the two columns are FLATTENED onto the user, not nested under `auth`.** That is the
decision worth recording:

```jsonc
{ "id": "…", "name": "Ayesha Rahman", "phone": "+880…",
  "email": "vendor1@trendora.test", "role": "VENDOR" }
```

- **The `User`/`Auth` split is a storage decision, not an API one.** It exists so a password hash
  never shares a table with a profile. Email and role are attributes of the *person*; there is no
  reason for a client to know they are stored one table over.
- **It matches the type the frontend already declares.** `TUser` has `email` and `role` flat
  (`frontend/src/features/users/types/user.types.ts`), so this side moved and the frontend needed
  no change at all — which is what "backend first" is supposed to look like.
- **Flattening is what keeps `password` out of the response.** `flattenAuth` destructures `auth`
  away and re-adds exactly two named fields, so the payload cannot grow a credentials column by
  someone later relaxing a `select`.
- `email`/`role` are `null` when a user somehow has no `Auth` row. Such an account cannot sign in,
  so it is a data problem rather than a normal state — but a missing row must not blank the row.

**Two things came with it that were not on the item, and both were already promised elsewhere in
the UI:**

1. **Search now covers email.** The admin table's own placeholder reads *"Search by name,
   email…"* — it had only ever searched `name` and `phone`. Email is the identifier an admin
   actually has when someone writes in about their account.
2. **`?sortBy=email:asc` and `role:asc` work** instead of returning the 400 that BE-14 + BE-15
   had (correctly) started producing. The alternative was deleting the frontend's Email sort
   option; making the endpoint honest was better, and it leaves the frontend untouched.

Both needed one small, general addition to `src/lib/PrismaQueryBuilder.ts` rather than a
special case in the user service:

| addition | shape | why it is general |
| --- | --- | --- |
| `search(fields, relationPaths)` | `search(["name","phone"], ["auth.email"])` → `{ auth: { is: { email: { contains } } } }` | a second parameter, so `fields` keeps its `keyof TWhereInput` typing — a dotted string is not a key, and widening the array to `string[]` would have dropped the compile-time check on all 15 existing callers |
| `sortAliases` config | `{ email: "auth.email" }` → `orderBy: { auth: { email: "asc" } }` | aliases are declared in code, never read from the query string, so this widens what is *sortable* without widening what a caller can *inject* |

The `is:` wrapper is deliberate: `User.auth` is optional (`Auth?`), and `is:` is the form that is
valid for both optional and required to-one relations. The bare shorthand happens to work today.

**Verified** against the live database:
- Every row returns flat `email` + `role`; `password` appears nowhere in the payload; `meta`
  present (`totalData: 8`, 3 pages at `limit=3`).
- `sortBy=email:asc` / `:desc` order correctly across all 8 accounts; `sortBy=role:asc` works.
- `search=vendor1` matches on **email alone** (1 hit), `search=Ayesha` on name, `search=+8801700000004`
  on phone, `search=TRENDORA.TEST` is case-insensitive (4 hits), `search=zzz-nothing` returns 0 —
  and `meta.totalData` tracks the filtered count, not the table count.
- `sortBy=password:asc` is still a 400, and the message now lists `email` and `role` among the
  sortable fields.
- All 15 `.search()` call sites re-checked live: products, categories, brands, slides, size-groups,
  sizes, reviews, addresses, vendors and both admin listings all still 200 and still filter.
- `pnpm lint` 0 errors / 1 pre-existing warning; `pnpm build` clean.

**Not done, deliberately:** `GET /users/my-profile` still omits `email`, so `TUser` remains
optimistic for that one endpoint. It is a different endpoint with a different consumer (the
profile form, which reads neither field), and no screen is broken by it.

**Noticed while testing, unrelated:** `authorization: bogus` returns **500** with
`errorDetails: { name: "JsonWebTokenError", message: "jwt malformed" }` — the raw thrown object.
That is **BE-06**, still open; a missing header correctly returns 401.

---

### ~~BE-21~~ · Brand validation silently drops `logo`
**✅ FIXED — 2026-09-22 · catalogue**

**Was:** `brandSchema` declared **only** `name`. `validateRequest` replaces `req.body` with the
parsed result and Zod strips unknown keys, so `logo` never reached `createIntoDB` — although
`Brand.logo` exists and the frontend sends it. `POST /brands` returned 201 with the logo gone.

The original entry said the logo could not be saved "through any path". That was half right:
`PATCH /brands/:id` had **no `validateRequest` at all**, so `logo` did persist there — and so did
every other key, straight into `prisma.brand.update({ data: req.body })`. An admin could flip
`isDeleted` back to `false` to resurrect a deleted brand, or rewrite `id` / `createdAt`.

**Now:** `src/modules/brand/brand.validation.ts` declares `logo` and exports a second schema:

- `logo` is a plain URL string (`Brand.logo` is `String?`) — **not** the `{ url, publicId }`
  handshake object `Vendor.logo` uses. It is validated with `z.url()`, so a typo is a 400 rather
  than a broken `<img>`.
- The admin form initialises `logo: ""` and submits its values verbatim, so the schema preprocesses
  a blank string to `null` instead of 400ing or storing `""`. The same rule is what lets an update
  **clear** an existing logo.
- `brandUpdateSchema` (every field optional, nothing outside the list) is now wired into the PATCH
  route, closing the mass-assignment hole above.
- The service types its payloads from `z.infer` rather than the Prisma `Brand` model, so the next
  field added to the schema is visible to the compiler instead of being silently dropped.

Verified by parsing each case directly: `logo: ""` → `null`, a Cloudinary URL passes through,
`"not-a-url"` → 400, and `isDeleted` / `id` are stripped on both create and update.

**Still open:** the frontend's `BrandForm` renders no logo input — it only carries the field in its
zod schema and default values. The backend now accepts a logo; nothing in the admin UI can supply
one yet. See **XR-03**.

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

### ~~BE-40~~ · `POST /auth/register` returns the bcrypt password hash
**✅ FIXED — 2026-09-22 · security**

**Was:** `registerUser` returned the raw `$transaction` result `{ user, auth }`, and `auth` was the
whole row — including `auth.password`. The controller passed it straight to `sendResponse`, so a
registration response body contained `"password":"$2b$10$ipSO4f3l...."` (confirmed live during the
BE-01 verification).

A password hash should never leave the server. It is only ever disclosed to the account holder who
just chose that password, so the direct risk is limited — but it lands in access logs, proxy logs,
browser devtools history and any client-side error reporting, which is exactly how hashes end up
somewhere they can be attacked offline. `bcrypt` cost 10 is not a large barrier for a weak password.

**Now:** both `create` calls in the transaction carry a `select`, so the hash is never read back
out of the database at all rather than being read and then deleted — there is no intermediate
object holding it for a later refactor to leak again. The response is flat, matching `GET /users`:

```json
{ "id", "name", "phone", "email", "role", "createdAt", "updatedAt" }
```

`email` and `role` live on `Auth`, but they are attributes of the person, so they are lifted onto
the user exactly as `flattenAuth` does for `GET /users`.

**This also settles the register half of XR-05.** The shape now matches the frontend's
`TAuthRegisterResponse` key for key; it previously matched neither that type nor anything else.
`register-form.tsx` only reads `res.success` and `res.message`, so nothing on that side needed to
change.

**Verified** by running both creates with the new `select`s against the dev database inside a
deliberately rolled-back transaction: the payload carries the seven keys above, contains no
`password` key and no `$2` bcrypt prefix, and left no row behind.

**Audited alongside:** `loginUser`, `oAuthLogin` and `generateTokenResponse` already return
projections; `changePassword` returns nothing; `refreshToken` returns only `accessToken`.
`registerUser` was the only leak.

---

### BE-41 · A failed temp promotion leaves a live image publicly deletable
**P1 · M · media**

**This is the real problem behind BE-04.** Verified against the live dev database.

Uploads land in `trendora/temp/<folder>/` and `moveFromTemp` (`src/utils/cloudinary.ts:14-25`)
renames them out of `temp/` on save. When that rename does not happen, the product is still saved
and can still be approved and published — with its image left in `temp/`:

```
product  : Nike White Beautiful eye catching shoes   (APPROVED, isPublished, not deleted)
publicId : trendora/temp/products/nejm6r1gqmvtbfcf6bxt
url      : https://res.cloudinary.com/coders-nihar/image/upload/v1776873625/
           trendora/temp/products/nejm6r1gqmvtbfcf6bxt.jpg
```

**1 of the 11 app-uploaded product images is in this state.**

The consequence is what makes BE-04 matter at all. The `/temp/` check is the only thing standing
between an anonymous caller and `cloudinary.uploader.destroy` — and a stuck image is *served on the
storefront*, so its publicId is sitting in plain sight inside the `<img src>`. Anyone who opens that
product page can read it and POST it to `/cloudinary/delete-temp`, unauthenticated, and the live
image is gone. The guard protects images whose promotion **worked**; it fails precisely for the ones
that did not.

Contributing bug: `moveFromTemp` does `tempPublicId.replace("/temp", "/")`, which turns
`trendora/temp/products/x` into `trendora//products/x` — a double slash. It currently works only
because Cloudinary normalises consecutive slashes on rename. It also replaces the *first* match of
`/temp` rather than a bounded path segment.

**Fix:**
- Make a save fail loudly when promotion fails, instead of persisting a `temp/` publicId. A listing
  should never reach APPROVED + published with an asset still in `temp/`.
- Replace the string surgery with an explicit path rebuild (strip the `temp` **segment**, not the
  first `/temp` substring).
- Repair the existing row — re-upload through the product edit form, or rename it in the Cloudinary
  console — and add a check that fails if any `ProductImage.publicId` still contains `/temp/`.

---

### BE-42 · The unsigned Cloudinary preset is an open upload endpoint
**P1 · M · media**

**Now:** the frontend uploads straight to Cloudinary with an unsigned preset
(`frontend/src/shared/utils/upload-to-cloudinary.ts:1-23`). Both
`NEXT_PUBLIC_CLOUDINARY_PRESET_NAME` and `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` are `NEXT_PUBLIC_`,
so they ship in the client bundle and anyone can read them from devtools.

**Gap:** that is an unauthenticated, unrate-limited upload endpoint into your Cloudinary account,
open to the whole internet. It costs storage and bandwidth on your bill, and it means the account
can be used to host arbitrary third-party content under your cloud name. This is a bigger exposure
than BE-04 — upload is open to *everyone*, whereas the delete needs a publicId that is ~20 chars of
Cloudinary randomness and is not published anywhere (except in the BE-41 case).

**Fix, cheapest first:**
1. In the Cloudinary console, constrain the preset: max file size, images-only formats, and a
   folder restriction. Minutes of work, no code.
2. Enable auto-delete on the preset so abandoned `temp/` uploads expire on their own — nothing in
   `src/` ever sweeps them, so today every abandoned form leaves an orphan forever.
3. The real fix is **signed uploads**: the backend issues a short-lived signature, the frontend
   uploads with it. That closes this, and it also makes `/cloudinary/delete-temp` naturally
   authenticated, which resolves BE-04 as a side effect.

---

## P2 — cleanup, and features never started

### BE-04 · `POST /cloudinary/delete-temp` is unauthenticated
**P2 · S · security** — _downgraded from P0 on 2026-09-22 after re-assessment._

**Now:** `src/modules/cloudinary/cloudinary.route.ts:7` registers an inline handler with no
`authGuard` and no `validateRequest`. The only check is `publicId.includes("/temp/")` at `:10`.

**Why this is P2, not P0.** The original rating assumed "unauthenticated delete of Cloudinary
assets" meant live assets were reachable. They are not, in normal operation: only publicIds
containing `/temp/` are accepted, temp assets are unsaved in-flight uploads, and their publicIds are
~20 characters of Cloudinary randomness (`nejm6r1gqmvtbfcf6bxt`) that appear in no public URL. There
is nothing to enumerate and nothing to discover, so an attacker would have to already know a
publicId — which effectively means they uploaded it.

The case where that breaks down is **BE-41**, where a stuck image is live on the storefront and its
publicId is readable from the `<img src>`. Fix BE-41 and this endpoint's residual risk is close to
nil.

**Note that adding `authGuard` alone would break the app.** `deleteTempImage`
(`frontend/src/shared/lib/delete-temp-image.ts:5-11`) is a raw `fetch` sending only
`Content-Type` — it is one of the two deliberate exceptions to "all server data goes through RTK
Query", so it never picks up the token injection in `base-api.ts`. Guarding the route without also
sending `session.accessToken` from the frontend turns every image replace and remove into a silent
401. This is a two-sided change or nothing.

**Fix (worth doing, low urgency):**
- ~~`publicId` is read straight off `req.body` with no null check, so a request without it throws a
  TypeError on `.includes` and returns a 500.~~ **✅ done (BE-26)** — the module has a
  `validateRequest` schema; a body without `publicId` is now a field-level 400.
- ~~Tighten `includes("/temp/")` to `startsWith("trendora/temp/")`.~~ **✅ done (BE-26)** — verified
  that `trendora/products/temp/x`, an ordinary final publicId the old substring check accepted, is
  now rejected. The frontend uploads to `trendora/<folder>` with every staging caller passing
  `temp/...`, so the anchored prefix matches every real staged asset.
- ~~Give the module the standard route/controller/service/validation shape.~~ **✅ done (BE-26).**
- **Still open:** authentication itself, best handled by **BE-42**'s signed-upload migration rather
  than bolted on here. The route stays public — `deleteTempImage` sends no token, so guarding one
  side alone turns every image replace into a silent 401.

---

### ~~BE-23~~ · SSLCommerz is a dead dependency and dead config
**✅ FIXED — 2026-09-22 · cleanup**

**Was:** `sslcommerz-lts` was a **production** dependency with zero imports, `src/types/
ssl-commerz.d.ts` was a full ambient declaration for it that nothing referenced, and four env keys
(`SSL_STORE_ID`, `SSL_STORE_PASSWORD`, `SSL_COMMERZ_API`, `SSL_VALIDATION_API`) sat in
`.env.example` read by nothing. `PaymentMethod` never had an SSLCommerz member. The whole thing
told every new contributor that SSLCommerz was a required integration.

**Now:** all of it is gone — the dependency, the `.d.ts`, and the four keys.

`envConfig.ssl` had already disappeared in the BE-19 env-validation rewrite, so that part of the
entry was stale.

**Removed alongside** (the tail of BE-24): `axios` and `@prisma/extension-accelerate`, neither of
which is imported anywhere. Three dependencies out took **18 packages** with them.

**Verified:** `pnpm lint` clean, `pnpm build` clean, and `src/app.ts` still imports and builds its
full router tree with the packages uninstalled.

---

### ~~BE-24~~ · Six exported helpers have zero callers
**✅ FIXED — 2026-09-22 · cleanup**

Re-checked all six. **Two had already been wired up by the BE-11 scheduler fix** and are no longer
dead: `expireStaleCheckoutSessions` (`scheduler/index.ts:72`, hourly) and `retrieveStripeRefund`
(`refund.ts:498`, inside `reconcileProcessingRefunds`). That entry was written before BE-11 landed.

**Deleted — three:**

| helper | why it was safe to remove |
| --- | --- |
| `generateTransactionId` (whole file) | zero references; Stripe issues its own ids and `generateOrderNumber` covers our side |
| `uuidSchema` (`utils/utils.ts`) | zero callers — the one mention was a *comment* in `product.validation.ts` saying its fields differ from it, which has been reworded |
| `cancelCheckoutSession` (`helpers/checkout.ts`) | zero callers **and unreachable**: nothing can trigger it — `/payment-cancel` is a frontend-only redirect that never calls the backend, and abandonment is already handled twice over by the `checkout.session.expired` webhook and the hourly sweep. Two lines to re-add if a "cancel my checkout" endpoint is ever built |

**Kept — one, deliberately:** `outstandingRefundForOrder` (`helpers/refund.ts:543`) still has no
callers, but `CLAUDE.md` names it as the contract for how "what a buyer is owed" is computed —
derived from the cancelled parcels, never stored, so it cannot go stale. It is not the same thing
as `/refunds/admin/outstanding`, which is a queue of *stuck Refund rows* across all orders rather
than a per-order balance. Deleting it would make the project doc wrong and the logic would have to
be re-derived the day that balance is surfaced on an order. **Open sub-item:** either surface it on
the admin order detail or drop it and amend `CLAUDE.md` — a product call, not a cleanup one.

The `axios` and `@prisma/extension-accelerate` dependencies noted at the end of this entry were
removed with BE-23.

---

### ~~BE-25~~ · Unreachable enum values
**✅ FIXED — 2026-09-22 · cleanup — the fourth bullet was the real gap; the first three were
mostly a mis-read**

**The mirror (fixed).** `AuthProviderEnum` now exists in `src/helpers/enum.ts` as the tenth mirror,
matching the Prisma enum member for member (`EMAIL | GOOGLE | FACEBOOK`), which restores the
"enums live in three places, all must agree" rule.

The inline copy in `auth.validation.ts` is gone. What replaces it is **explicitly a subset**,
derived from the mirror rather than hand-copied:

```ts
const OAUTH_PROVIDERS = [AuthProviderEnum.enum.GOOGLE] as const;
```

The original entry read "drops `EMAIL`" as the bug. It is not — `EMAIL` is the stored default for
password accounts and must **never** be accepted at `/auth/oauth-login`. The bug was the opposite
one: the schema *advertised* `FACEBOOK` ("Provider must be GOOGLE or FACEBOOK") when no Facebook
OAuth exists on either side, so a client could create an `OAuthAccount` row that nothing can ever
authenticate against. `GOOGLE` is now the only accepted value, which is also the only one the
frontend sends (`auth-options.ts` has exactly one `GoogleProvider`).

**Verified:** `"google"` and `"GOOGLE"` both parse and normalise to `GOOGLE`; `"facebook"`,
`"EMAIL"` and `"twitter"` all 400 with *"Provider must be one of: GOOGLE"*; the mirror's options
compare equal to `Object.values(AuthProvider)` from the generated client.

**The three enum values are deliberately NOT removed.** Dropping a value from a Postgres enum is a
migration that fails outright if any row uses it, and per value the case for removal does not hold:

| value | verdict |
| --- | --- |
| `Gender.KIDS` | **keep.** This is a clothing marketplace and the frontend already offers a *Kids* filter option (`shared/constants/mock-products.ts:129`). The real gap is that the seed lists no kids products — not that the taxonomy is wrong. Removing it would be a product regression |
| `PayoutStatus.PROCESSING` | **keep.** A bank transfer in flight is exactly this state, and the mirror concept `RefundStatus.PROCESSING` is live and swept every 30 minutes. `payout.service.ts` not writing it yet is a missing transition, not a surplus enum value |
| `AuthProvider.FACEBOOK` | **keep for now.** It is genuinely speculative, but nothing can write it any more now that validation rejects it, so it costs nothing where it sits. Dropping it is a one-line schema change plus a migration — worth folding into the next migration rather than raising one for a dead label |

Confirmed against the dev database that no row uses any of the three
(`Product.gender` is `UNISEX`/`WOMEN`/`MEN` only, the single `OAuthAccount` is `GOOGLE`, and
`Payout` is empty), so that migration would apply cleanly here whenever it is wanted.

---

### ~~BE-26~~ · Four modules are half-built
**✅ FIXED — 2026-09-22 · structure**

**The decision:** the two sub-resource modules were **completed, not deleted.** `PATCH
/products/:id` takes the whole `variants` and `images` arrays and deletes any row whose `id` the
client failed to round-trip — and for an image that **destroys the Cloudinary asset**. That is the
footgun `CLAUDE.md` warns about, and the only way to avoid it was for every caller to resend both
collections in full just to change one price. Per-row endpoints remove the need to resend anything.

**Now, under `/products/:productId`:**

| | variants | images |
| --- | --- | --- |
| `GET` | list | list |
| `POST` | add one or many | add one or many |
| `PATCH /:id` | `sizeId`, `color`, `stock`, `price` | `isMain`, `altText` |
| `DELETE /:id` | soft delete | hard delete + Cloudinary |

Every write answers with the **whole refreshed collection**, so a dashboard never needs a follow-up
GET.

**Four things that fell out of building it, each of which was a live defect:**

1. **The two GETs were ungated — a storefront leak.** `GET /products/:id` applies
   `publicProductFilter` and 404s on a draft, an unpublished listing or one whose store is
   suspended. `GET /products/:id/variants` applied nothing, so anyone could read the pricing and
   stock of an unreleased listing by guessing a product id. Both GETs now go through
   `resolveViewableProduct`. Verified: unpublishing the test product turns both into 404s.
2. **Variants were HARD deleted.** `OrderItem.variantId` is `ON DELETE SET NULL` (init migration
   line 439), so removing a variant silently detached every past order line that sold it from what
   it sold. `ProductVariant.isDeleted` existed for this and was never used — exactly the rule
   `CLAUDE.md` states for `Address`. Variant deletes are now soft, in the new endpoint **and in
   `PATCH /products/:id`**, and all 13 read sites filter through the shared `liveVariants`.
   `helpers/order.ts` already filtered this way, so the convention was half-adopted.
3. **`variant.validation.ts` did not match the model.** It declared `size: z.string()` where the
   column is `sizeId`, made it required where it is nullable, and used `.positive()` for `stock` —
   which made "sold out" unsettable. Rewritten.
4. **Nothing stopped two variants sharing a (size, colour) pair.** There is no DB constraint and
   the cart could not tell them apart; both write paths now 409.

**Moderation is wired to match `MATERIAL_FIELDS`, not guessed:** adding or removing an image
re-opens moderation on an APPROVED listing (imagery is material) and the response *says so*, so a
vendor is not left wondering why their live product dropped to Pending. Variant writes deliberately
do not — same reason `price` and `stockQuantity` are absent from `MATERIAL_FIELDS`. Setting a hero
image or editing alt text does not either: that is presentation of imagery already approved.

Also handled: exactly one `isMain` per product (enforced in-transaction, since the column is a
plain boolean); the last image cannot be deleted (`productSchema` requires one to create);
deleting the hero promotes another; and `assertPromoted` refuses to persist a publicId still under
`temp/` (BE-41's invariant).

**`src/modules/cloudinary/`** now has the standard four files. Two fixes from BE-04 came with the
split — see that entry. **`payment.validation.ts`** (0 bytes) was **deleted**: the webhook body is
a raw Stripe event authenticated by signature, so there is nothing for Zod to validate.
**`image.validation.ts`** (0 bytes) is now real. `image.service.ts`'s copy-pasted `variants`
variable is gone.

**Verified against a running server and the dev database — 52 assertions, all passing:** auth
(401), cross-store ownership (404 both directions, never 403), the visibility fix, duplicate 409s,
empty-body 400s, `stock: 0` now accepted, soft delete invisible in three separate read paths, the
APPROVED→PENDING flip on image add *and* delete with `approvedAt` cleared, variants leaving status
untouched, and `isMain` exclusivity surviving an add/delete cycle. Every row the run created was
purged afterwards and the product was returned to its exact prior state (8 variants, 2 images, 1
main, APPROVED, published).

**Still open — the frontend does not call any of this yet.** The product form still submits both
collections through `PATCH /products/:id`, so the round-trip-the-ids footgun is live until it moves
to these endpoints. See **XR-02**.

---

### BE-27 · `PrismaQueryBuilder` is entirely `any`-typed
**P2 · M · types**

`src/lib/PrismaQueryBuilder.ts:1` carries a file-level
`/* eslint-disable @typescript-eslint/no-explicit-any */` and uses ~18 `any`s. Every list endpoint
in the app goes through it, so the one piece of shared infrastructure handling untrusted query
input has no type safety. (Credit where due: there is **zero** `any` in any `*.service.ts`.)

---

### ~~BE-28~~ · No `Payment` read endpoint
**✅ FIXED — 2026-09-22 · payments**

**Was:** the `Payment` model had full gateway fields but was only ever written, by the webhook.
No `GET /payments*` route existed, while the frontend declared a `payments` RTK Query tag that
nothing provided — refund mutations still invalidate it (`refund.api.ts:70,78,91,103`).
(The original entry cited **XR-07** for that; XR-07 is the free-shipping-at-zero divergence. The
tag claim is correct, the cross-reference was wrong.)

**Now**, all read-only — payment state is owned by the gateway and reconciled by the webhook and
`reconcilePayment`; there is no endpoint that lets a client set it, and there should not be:

| route | who | returns |
| --- | --- | --- |
| `GET /payments/me` | buyer (all three roles — a VENDOR is also a shopper) | their own payments, paginated |
| `GET /payments/order/:orderId` | that order's buyer, or ADMIN | one payment |
| `GET /payments/admin/all` | ADMIN | the ledger, filterable (`?status=FAILED`) |
| `GET /payments/:id` | ADMIN | full detail + its refunds |

**A seller is deliberately not an audience.** One payment covers every store on the order, so
there is no slice of it that belongs to one vendor; what a seller legitimately needs — *has the
buyer paid?* — is already `order.paymentStatus` on their own parcel.

`paymentRouter` is a **second router in the same module** and only it goes in `routes-array.ts`.
`stripeWebhookRouter` must stay mounted at `/webhook` above `express.json()`; these reads must sit
under `/api/v1` below it. One router could not be both, which is why they are separate.

#### The leak this surfaced

Deciding what a buyer may see meant looking at where `Payment` was *already* exposed — and
`getOrderById` included `payment: true` and `refunds: true`, the **raw rows**.

`Payment.gatewayResponse` holds the entire Stripe Checkout Session, which carries
`customer_details`: the buyer's **name, email, phone and billing address**. `Refund.gatewayResponse`
is the same for a refund, plus our `idempotencyKey`. That endpoint's own doc comment says it is
reachable by *"the buyer who placed it, an ADMIN, or a VENDOR who has a slice of it"* — so **any
seller holding one parcel of an order received the buyer's full Stripe session**, and the
order-level `refunds` array handed them refund amounts for competitors' parcels of the same order.

This is exactly BE-13 again (`OrderStatusHistory` leaking the buyer's IP to sellers), so it is
fixed the same way — `sanitizePayment` / `sanitizeRefund` in `src/helpers/payment.ts`, narrowing
by **audience, not role**:

- **admin** — everything. `gatewayResponse` is kept precisely because it is what an operator
  reconciles against the Stripe dashboard.
- **buyer** — everything except `gatewayResponse`. Amounts stay: it is their basket.
- **seller** — `{ method, status, paidAt }` and nothing else, and refunds filtered to their own
  parcels. No basket total, for the same reason `getOrderById` already blanked the order's money
  fields for a vendor.

`buyerPaymentSelect` is written as a Prisma `select` rather than reusing the sanitizer, so on the
new endpoints the blob is never loaded at all — a projection that cannot return a field cannot
regress into returning it.

**Verified against a running server — 39 assertions, all passing.** A real two-store COD order was
placed through `POST /orders`, given a `gatewayResponse` containing a `customer_details` block, and
read back by all four accounts: the buyer and both sellers get no `gatewayResponse` anywhere, a
seller's `payment` has exactly the three keys above, a seller 404s on `/payments/order/:id`,
`/payments/admin/all` and `/payments/:id` are 403 for both non-admins, `?status=` filters and
`?sortBy=nonsense:asc` 400s through `PrismaQueryBuilder`, and the admin still sees the blob. The
order, its payment, its parcels and the address it created were deleted afterwards and both
products' stock restored — the database is back to 0 orders and 0 payments.

**Still open:** the frontend has no `payments` feature folder, so nothing calls these yet. The tag
it already declares is now providable.

---

### BE-29 → BE-39 · Marketplace capabilities not started

| ID | Capability | Nearest existing thing |
| --- | --- | --- |
| BE-29 | **Coupons / promo codes.** No model, no module. `Order.discount` and `OrderItem.discount` (`schema.prisma:397,491`) are always derived from `basePrice − discountPrice`; `DISCOUNT_RATE` sits unread in `.env.example:46` | per-product `discountPrice` |
| BE-30 | **Returns / RMA.** There is a refund *ledger* but no return request, RMA number, return shipping or restocking flow. `OrderStatus` has no `RETURNED` (`schema.prisma:687-693`) | `Refund` |
| BE-31 | **Shipping methods, zones, carriers.** One flat fee + one threshold per store (`schema.prisma:123-124`). `VendorOrder.carrier` / `trackingNumber` (`:450-451`) are free text with no carrier registry or tracking API | flat per-vendor fee |
| BE-32 | **Stock reservation and low-stock alerts.** Stock is deducted at COD creation or at the Stripe webhook, so the last unit can be sold twice between checkout and charge — the webhook then fails the stock guard and that charge needs refunding by hand | conditional `updateMany` guard |
| BE-33 | **Search facets / full-text.** `.search()` is a naive `contains` over `name` and `description` (`product.service.ts:172`). No price/rating/colour/size/in-stock facet counts, no full-text index | `?search=` substring |
| ~~BE-34~~ | ~~**Admin user management.**~~ ✅ **FIXED 2026-09-22** — see its own section below | `GET /users` |
| ~~BE-35~~ | ~~**Vendor moderation audit log.**~~ ✅ **FIXED 2026-09-22** — see its own section below | three columns |
| BE-36 | **Support tickets, disputes, buyer↔vendor messaging.** None. Refund `reason` is free text (`schema.prisma:557`) | — |
| BE-37 | **Reporting.** Two hand-rolled endpoints: `GET /orders/analytics` and `GET /vendors/me/dashboard`. No date ranges, no export, no sales-by-period, no cohorts | two dashboards |
| BE-38 | ~~**Tax rules.** No per-category rate~~ — **done 2026-09-22**, see below. Jurisdiction rates, exemptions and VAT/GST ids on orders remain unbuilt, by choice | `Category.taxRate` |
| ~~BE-39~~ | ~~**Schema warnings.**~~ ✅ **FIXED 2026-09-22** — see its own section below | — |

Also absent: server-side cart (cart lives in frontend localStorage; only `CheckoutSession` exists
server-side), product Q&A, comparison, recently-viewed, bundles, gift cards, loyalty,
multi-currency, i18n.

---

### BE-38 · Flat platform tax rate only
**✅ PARTIAL — 2026-09-22 · tax — includes two migrations**

BE-38 bundled four separate features: per-category rates, jurisdiction rates, exemptions, and
VAT/GST ids on orders. **Per-category rates were chosen and built; the other three were not
started.** The remaining scope is restated at the end of this entry rather than being quietly
dropped.

#### What exists now

`Category.taxRate Decimal?(5,4)` — a fraction, so `0.1800` is 18%.

**`NULL` and `0` mean different things.** NULL is "use the platform rate" (`TAX_RATE`), which is
what every category does until an admin sets one; `0` is genuinely zero-rated. The resolution
checks for null explicitly rather than falsiness, or a zero-rated category would silently fall back
to charging 5%.

**The rate is not inherited from `parent`.** A child category with NULL falls back to the platform
rate, not to its parent's — otherwise the effective rate would depend on where a category sits in a
tree an admin can re-parent at any time.

**Tax is now per line, summed per parcel:**

```
per item:   taxRate = category.taxRate ?? TAX_RATE
            tax     = round2(subtotal x taxRate)
per vendor: tax     = round2( sum over items of subtotal x taxRate )
```

**This is exactly backward compatible.** When every category is NULL, the sum collapses to
`round2(subtotal x TAX_RATE)` — algebraically the old formula, not an approximation of it. The
per-line products are summed exactly and rounded once per parcel, so rounding cannot drift either.
Verified: a two-store cart quoted 500.90 before and after, to the cent.

**The rate is snapshotted per line.** `OrderItem.taxRate` and `OrderItem.tax` are new columns,
written by `persistOrder`, for the same reason `VendorOrder.commissionRate` is a snapshot: an admin
re-rating a category must never rewrite what a past invoice charged. Without the per-line columns a
mixed-rate parcel could not produce a correct invoice breakdown at all — `VendorOrder.tax` is only
the total.

Migrations `20260922...category_tax_rate` and `..._order_item_tax_snapshot` are both additive; the
`OrderItem` columns default to 0 so existing rows are untouched.

#### Two things fixed on the way

- **`PATCH /categories/:id` had no `validateRequest` at all**, and the service passed `req.body`
  straight into `prisma.category.update` — so `isDeleted`, `id` and `createdAt` were all settable.
  Exactly the hole BE-21 closed on Brand, and it matters more here because this is the route an
  admin uses to set a **tax rate**. `categoryUpdateSchema` now guards it, and `taxRate` is range-
  and precision-checked (0–1, at most 4dp, matching `Decimal(5,4)`) so a value the column would
  silently truncate is a 400.
- **Product payloads now carry `category.taxRate`**, on every read a cart line can be built from.
  Without it the frontend could not mirror the new maths, and `CLAUDE.md` promises the two agree to
  the cent.

**Verified against a running server — 35 assertions across two runs, all passing.** An all-NULL
cart prices identically to before; Jeans at 18% and Sneakers zero-rated moved a two-store cart from
500.90 to 512.84 with the zero-rated parcel paying no tax at all; **two categories inside one
vendor's parcel** taxed 20% and 0% produced a parcel tax that is the sum of its lines and equals
neither `subtotal x 0.20` nor `subtotal x 0`; `commissionAmount + vendorEarning == subtotal +
shippingCost` still held; and re-rating a category afterwards did **not** change the stored order.
Out-of-range, negative and 6-decimal rates 400; a customer setting a rate 403s. Every category rate
was cleared afterwards, the test order deleted and its stock restored — 0 orders, 0 rated
categories.

#### Deliberately not built

- **Jurisdiction rates.** Tax by shipping country/state needs a `TaxRate` table and changes the
  checkout UX: the cart cannot quote tax until an address is chosen, which is a visible frontend
  change, not just a mirrored formula.
- **Exemptions / reverse charge**, and **VAT/GST ids on `Order`**. `Vendor.taxId` exists and is
  captured at application time; nothing reads it.

#### Still open on the frontend

`calculate-order-total.ts` still multiplies the whole cart by `NEXT_PUBLIC_TAX_RATE`. Until it
reads each line's `category.taxRate`, **a cart containing a re-rated category will quote a
different tax than the backend charges** — the backend is authoritative, so the buyer is charged
correctly, but the displayed figure is wrong. The backend half is safe to deploy on its own only
while every `Category.taxRate` is NULL, which is the state it ships in.

---

### ~~BE-39~~ · Two `onDelete: SetNull` warnings on required columns
**✅ FIXED — 2026-09-22 · schema — includes a migration**

**The entry's premise was wrong.** It said fixing this "means making those columns optional, which
is a frontend contract change". It does not. The columns are right; the **referential action** was
wrong, and correcting it changes no API shape at all.

`SET NULL` on a `NOT NULL` column is not a policy, it is an impossibility. Postgres would never
null the column — it would raise a not-null violation instead — so both relations were promising
behaviour that could not happen, and the only thing a delete could ever produce was a confusing
500.

**Worth knowing: this was a regression, not an original sin.** The init migration had the correct
actions — `Size.sizeGroupId` was `CASCADE`, `Order.shippingAddressId` was `RESTRICT`. Migration
`20260428081248_customise_on_delete_cascade_mode` replaced both with `SET NULL`.

**Now** (migration `20260922142144_restrict_instead_of_setnull_on_required_fks`), both are
`Restrict`, which is what the code already assumes:

- **`Order.shippingAddressId`** — an address an order points at must survive. That is precisely
  why `Address` is soft-deleted and why every order carries its own `shippingSnapshot`. `Restrict`
  is what the init migration had.
- **`Size.sizeGroupId`** — `Restrict` rather than restoring the original `Cascade`: the service
  soft-deletes size groups, so a hard delete only happens from a console, and there it should be
  refused rather than silently destroying every size in the group and nulling `ProductVariant
  .sizeId` on the variants using them.

`Size.sizeGroup` was also typed `SizeGroup?` while its FK column is `NOT NULL`. It is now
non-optional, so the generated client matches the database. This only removes null checks; it
cannot break a caller.

**`P2003` is now handled** in `globalErrorHandler` — a `Restrict` refusal returns **409 "still
referenced by other data"** instead of falling through to a 500. That branch was unreachable before
this change.

**Verified against the dev database**, each probe inside a rolled-back transaction: hard-deleting a
size group with 9 sizes is refused with **P2003** (not a not-null violation), the soft delete the
API actually uses still works, and `size.sizeGroup` comes back non-null. `pnpm prisma validate` is
now **warning-free** — it had printed these two on every run. Nothing in the database was changed.

---

### ~~BE-35~~ · Vendor moderation audit log
**✅ FIXED — 2026-09-22 · marketplace — includes a schema migration**

**Was:** `Vendor` kept `rejectionReason`, `approvedAt` and `suspendedAt`, but each is a single
*current* value. It could not say **which admin acted**, and it forgot every earlier decision the
moment the next one overwrote it — a store suspended, reinstated and suspended again looked
identical to one suspended once.

**Now:** a `VendorStatusHistory` table, built to the entry's own suggestion — the
`OrderStatusHistory` pattern, field for field (`oldStatus`, `newStatus`, `note`, `ipAddress`,
`userId`, `createdAt`).

**This is the first schema change in this audit.** Migration
`20260922141405_add_vendor_status_history` is purely additive: one `CREATE TABLE`, two indexes,
two foreign keys, nothing existing touched. `userId` is `ON DELETE SET NULL`, so removing a staff
account never erases the record of what they did; `vendorId` cascades with the store.

#### Every door that changes a store's state now logs

| event | recorded as |
| --- | --- |
| seller applies | `— → PENDING`, actor is the **applicant**, not an admin |
| rejected seller re-applies | `REJECTED → PENDING` |
| admin approves | `PENDING → APPROVED` |
| admin rejects | `PENDING → REJECTED`, note is the reason the seller was given |
| admin suspends | `APPROVED → SUSPENDED`, note is the reason |
| admin reinstates | `SUSPENDED → APPROVED` |
| admin deletes the store | `→ SUSPENDED`, "Store deleted by an admin" |
| **admin disables the owner's account** | `APPROVED → SUSPENDED`, "Owner account disabled" |

That last row is the one worth calling out: `disableUser` (BE-34) suspends a seller's store as a
side effect, so it is a **second door into the same state change**. Without logging there, a store
would show as suspended with nothing saying who did it or why.

**Commercial-terms changes are logged too**, which goes slightly beyond "moderation" and is a
deliberate call: an admin editing someone else's commission is exactly the *"who did this to my
store, and when?"* question the trail exists to answer. Those rows carry `oldStatus === newStatus`
and spell the change out — `Terms updated — commission 0.1 → 0.11`. A settings write that changes
nothing writes **no row**.

Every write shares a transaction with the change it describes (`logVendorStatusChange` takes a
`TransactionClient`, not the shared client) — a trail that can commit without its event, or the
reverse, is worse than none. `suspendVendor` and `reinstateVendor` were bare `update` calls and are
now transactions for this reason.

#### Who sees what

Same narrowing as `sanitizeStatusHistory` for orders, via `sanitizeVendorHistory`:

- **Admin** (`GET /vendors/admin/:id`) — the full trail, newest first, with the acting admin and
  their IP.
- **The seller** (`GET /vendors/me`) — their own trail, oldest first, **with the reasons**, which
  is the point: being told the store was suspended and why. The moderator's personal name and IP
  are stripped; that is abuse-investigation data and abuse investigation is admin work.

**Verified against a running server — 48 assertions across two runs, all passing.** A throwaway
account was registered, applied, rejected, re-applied, approved, and then had its owner disabled,
producing exactly this trail:

```
        — -> PENDING   | Application submitted
  PENDING -> REJECTED  | Probe rejection: incomplete details
 REJECTED -> PENDING   | Application resubmitted
  PENDING -> APPROVED  | Store approved
 APPROVED -> SUSPENDED | Owner account disabled
```

Separately, on a real seeded store: suspend → reinstate → terms change added three rows and a
no-op settings write added none; the seller's view carried the same rows and reasons with no
`actor` and no `ipAddress`; a seller reading the admin view got 403. The probe account and store
were deleted afterwards, the seeded store's commission restored to 0.1, and the rows my own test
actions left were removed — 8 users, 0 disabled, all three stores APPROVED, 0 history rows.

**Note on existing data:** the three seeded stores predate the table, so their trails start empty.
Nothing backfills them — there is no record of when they were approved beyond `approvedAt`.

**Still open:** no frontend surfaces the trail yet, on either the admin store detail or the seller's
own dashboard.

---

### ~~BE-34~~ · Admin user management
**✅ FIXED — 2026-09-22 · users**

**Was:** `GET /users` was the only admin user route. No get-by-id, no ban, no soft-delete, no role
assignment — a `Role` could only change through vendor approval or a manual database edit.

**Now**, all ADMIN-only, declared after the `/my-profile*` literals so neither is matched as an id:

| route | does |
| --- | --- |
| `GET /users/:id` | detail: flattened `email`/`role`, their store if they have one, and counts of orders / reviews / addresses |
| `DELETE /users/:id` | **disable** the account (soft delete) |
| `PATCH /users/:id/restore` | re-enable it |
| `PATCH /users/:id/role` | assign `CUSTOMER` / `VENDOR` / `ADMIN` |

`DELETE /users/:id` is the call the frontend's `useDeleteUserMutation` has been making into a 404
all along — that half of **XR-02** is closed.

#### The rules, and why each one is there

**An admin may not act on their own account.** Disabling or demoting yourself locks you out with no
way back, and `authGuard` reads the role from the database, so it lands on the very next request.

That one rule is also what keeps the platform from losing its last admin. The obvious extra guard —
*"refuse if this is the only active ADMIN"* — was written, then **removed as unreachable**: the
caller has already passed `authGuard(Role.ADMIN)`, so they are themselves an active admin and
cannot be the target, which means any admin target leaves at least two. It is documented in the
service rather than shipped as a branch that can never run.

**VENDOR is not freely assignable, in either direction.** Store approval is what makes someone a
seller — `vendor.service.ts` flips `Auth.role` inside the same transaction that approves the store.
A second, independent way to set it would let `Auth.role` disagree with `Vendor.status`, and the
whole marketplace authorization layer (`requireApprovedVendor`, `resolveVendorScope`) reads both.
So promoting to VENDOR requires an approved store, demoting away from it requires the store not be
approved, and both errors name the endpoint that does the job properly.

**Disabling a seller suspends their store,** in the same transaction. Leaving it APPROVED would
keep their catalogue live and sellable while the account behind it cannot log in to fulfil
anything. Restoring the account deliberately does **not** lift the suspension — that is a separate
judgement with its own endpoint, and a seller whose store is still suspended gets an actionable 403
from `requireApprovedVendor` rather than a half-working dashboard.

#### A hole this closed on the way

`POST /auth/refresh-token` did `findUniqueOrThrow` on `Auth` with **no `isDeleted` check**, so a
banned account could keep minting fresh access tokens for the remaining 30 days of its refresh
token. `authGuard` would reject each one, so nothing was actually reachable — but the refresh
itself kept succeeding, which tells the client the session is healthy and renews it indefinitely. A
ban that leaves the session alive is not a ban. It now 401s.

**Verified against a running server — 55 assertions across two runs, all passing.** Role changes
land on an *already-issued* token in both directions (promote → the old token reaches an admin
route; demote → the same token 403s), which is BE-07's database-not-claim rule paying off. A
disabled user's live token 401s, their login is refused, their refresh token 401s, they drop out of
the admin list but stay reachable by id so they can be restored. Disabling a seller suspended
*Urban Threads* and its storefront 404'd; restore left it suspended; `PATCH /vendors/:id/reinstate`
brought both back. Every account and store was returned to its exact prior state afterwards — 8
users, 0 disabled, all three stores APPROVED.

**Still open:** the frontend has the `deleteUser` mutation and nothing else — no user detail
screen, no role control, no restore. This is the backend half.

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
- ~~`DELETE /users/:id` (`frontend/src/features/users/api/user.api.ts:48-53`) — no such route~~
  **✅ fixed (BE-34)**: the route exists and soft-deletes (disables) the account. The mutation
  should now work as written; there is still no admin UI for restore or role assignment.

**Routes here that no frontend code calls:** `POST /auth/forgot-password` and `POST /auth/reset-password` (both now correct and waiting on the frontend — XR-11);
`GET /products/:productId/variants` and `GET /products/:productId/images` (variants and images
always arrive nested) **— plus, as of BE-26, the `POST`/`PATCH`/`DELETE` now sitting beside them.
Those are worth wiring up rather than noting: the product form currently edits imagery through
`PATCH /products/:id`, which deletes any image whose `id` it fails to round-trip and destroys the
Cloudinary asset with it**; `GET /wishlists/:id`; `PATCH`/`DELETE /vendor-reviews/:id`;
`GET /vendor-reviews/my-reviews`; `GET /address` (admin list); the whole slide write CRUD;
`GET /payouts/:id`; `GET /refunds/:id`. Each is a screen the frontend planned and did not build —
see FE-14 and the frontend's unused-hook list. The Stripe webhook routes are correctly excluded
from this count.

---

### ~~XR-03~~ · Brand `logo` is stripped before the service sees it
**✅ FIXED (backend half) — 2026-09-22 · contract**

See BE-21. The backend now declares, validates and persists `logo`, and treats the empty string the
frontend sends as "no logo".

**Still open on the frontend:** `BrandForm`
(`frontend/src/features/brands/components/brand-form.tsx`) declares `logo` in its zod schema and
default values but renders **no input for it**, so the field is always `""`. An admin cannot set a
brand logo until that form grows an upload control.

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
| ~~`TUser.email`, `TUser.role` required; `meta` for pagination~~ | ~~`GET /users` sends neither~~ — **fixed (BE-15 + BE-20)**: `meta` is returned and both fields arrive **flat**, exactly as `TUser` declares them |
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
- ~~**Profile name:** `userUpdateSchema` requires `min(5)`, the frontend form `min(1)`.~~
  **Settled 2026-09-22 (BE-08):** the backend relaxed to `min(1)` to match registration and the
  frontend. `min(5)` would have locked anyone who registered as "Li" out of their own profile.
  No frontend change needed.
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
- ~~`sortBy` is unvalidated~~ — **fixed (BE-14)**: every list endpoint now validates against the
  model's real columns and returns a 400 naming the valid ones. The frontend's `userSortOptions`
  offers `email`, which is on `Auth` not `User` — **BE-20 made that option work** by declaring
  `email`/`role` as relation aliases on the user list, so no frontend change is needed. Sorting by
  `role` orders by the enum's **database** declaration order (`CUSTOMER < ADMIN < VENDOR`), which
  is not alphabetical and does not match the order in `schema.prisma` (`CUSTOMER, VENDOR, ADMIN`) —
  Prisma never reorders an existing enum type. Harmless, but surprising if you expect A–Z.

---

### XR-09 · Enum drift
**P2 · S · contract**

`prisma/schema.prisma:667-748` and `src/helpers/enum.ts:10-66` **agree on all nine mirrored
enums**. The gaps are at the edges:

- ~~**`AuthProvider` has no Zod mirror**, and the inline copy at `auth.validation.ts:37-43` drops
  `EMAIL`~~ — **fixed (BE-25)**: `AuthProviderEnum` is the tenth mirror, and `/auth/oauth-login`
  now takes an explicit subset of it (`GOOGLE` only). Dropping `EMAIL` there was correct and is
  now commented as such.
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
