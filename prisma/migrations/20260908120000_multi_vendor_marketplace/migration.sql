-- ============================================================================
-- Multi-vendor marketplace
--
-- Converts the single-seller catalogue into a marketplace:
--   * Vendor            — a seller's storefront, one per User
--   * VendorOrder       — one vendor's slice of an Order (fulfilment + payout unit)
--   * Payout            — batched vendor earnings the platform settles
--   * VendorReview      — buyer rating of a store
--   * CheckoutSession   — server-side priced draft of an order awaiting payment
--
-- This migration is DATA PRESERVING. Existing products and orders are adopted
-- by a single backfilled store ("Trendora Official") owned by the oldest ADMIN,
-- so nothing 404s after deploy. Steps 4 and 8 do that work; they are no-ops on
-- an empty database.
-- ============================================================================

-- ------------------------------------------------------------------ 1. Enums
CREATE TYPE "public"."VendorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "public"."ProductStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "public"."PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');
CREATE TYPE "public"."CheckoutSessionStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'CANCELED');

-- Postgres forbids *using* a new enum value in the transaction that adds it.
-- Nothing below writes 'VENDOR', so this is safe here.
ALTER TYPE "public"."Role" ADD VALUE 'VENDOR';

-- ------------------------------------------------------------- 2. New tables
CREATE TABLE "public"."Vendor" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "logoPublicId" TEXT,
    "banner" TEXT,
    "bannerPublicId" TEXT,
    "status" "public"."VendorStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "businessEmail" TEXT NOT NULL,
    "businessPhone" TEXT NOT NULL,
    "taxId" TEXT,
    "payoutDetails" JSONB,
    "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.1000,
    "shippingFee" DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    "freeShippingThreshold" DECIMAL(10,2) NOT NULL DEFAULT 1000.00,
    "averageRating" DECIMAL(3,2),
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Payout" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "public"."PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "reference" TEXT,
    "payoutDetails" JSONB,
    "failureReason" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."VendorOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorOrderNumber" TEXT NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shippingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL,
    "commissionAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "vendorEarning" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "orderStatus" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "trackingNumber" TEXT,
    "carrier" TEXT,
    "cancelReason" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."VendorReview" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorOrderId" TEXT NOT NULL,
    "rating" DECIMAL(3,2) NOT NULL,
    "comment" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."CheckoutSession" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shippingAddressId" TEXT NOT NULL,
    "paymentMethod" "public"."PaymentMethod" NOT NULL,
    "calculation" JSONB NOT NULL,
    "amountTotal" DECIMAL(10,2) NOT NULL,
    "status" "public"."CheckoutSessionStatus" NOT NULL DEFAULT 'PENDING',
    "stripeSessionId" TEXT,
    "notes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

-- Indexes for the new tables
CREATE UNIQUE INDEX "Vendor_ownerId_key" ON "public"."Vendor"("ownerId");
CREATE UNIQUE INDEX "Vendor_storeName_key" ON "public"."Vendor"("storeName");
CREATE UNIQUE INDEX "Vendor_slug_key" ON "public"."Vendor"("slug");
CREATE INDEX "Vendor_slug_idx" ON "public"."Vendor"("slug");
CREATE INDEX "Vendor_status_idx" ON "public"."Vendor"("status");
CREATE INDEX "Vendor_isDeleted_idx" ON "public"."Vendor"("isDeleted");

CREATE INDEX "Payout_vendorId_idx" ON "public"."Payout"("vendorId");
CREATE INDEX "Payout_vendorId_status_idx" ON "public"."Payout"("vendorId", "status");
CREATE INDEX "Payout_status_idx" ON "public"."Payout"("status");
CREATE INDEX "Payout_createdAt_idx" ON "public"."Payout"("createdAt");

CREATE UNIQUE INDEX "VendorOrder_vendorOrderNumber_key" ON "public"."VendorOrder"("vendorOrderNumber");
CREATE INDEX "VendorOrder_vendorId_idx" ON "public"."VendorOrder"("vendorId");
CREATE INDEX "VendorOrder_vendorId_orderStatus_idx" ON "public"."VendorOrder"("vendorId", "orderStatus");
CREATE INDEX "VendorOrder_orderId_idx" ON "public"."VendorOrder"("orderId");
CREATE INDEX "VendorOrder_payoutId_idx" ON "public"."VendorOrder"("payoutId");
CREATE INDEX "VendorOrder_createdAt_idx" ON "public"."VendorOrder"("createdAt");
CREATE UNIQUE INDEX "VendorOrder_orderId_vendorId_key" ON "public"."VendorOrder"("orderId", "vendorId");

CREATE INDEX "VendorReview_vendorId_idx" ON "public"."VendorReview"("vendorId");
CREATE INDEX "VendorReview_userId_idx" ON "public"."VendorReview"("userId");
CREATE UNIQUE INDEX "VendorReview_userId_vendorOrderId_key" ON "public"."VendorReview"("userId", "vendorOrderId");

CREATE UNIQUE INDEX "CheckoutSession_orderNumber_key" ON "public"."CheckoutSession"("orderNumber");
CREATE UNIQUE INDEX "CheckoutSession_stripeSessionId_key" ON "public"."CheckoutSession"("stripeSessionId");
CREATE INDEX "CheckoutSession_userId_idx" ON "public"."CheckoutSession"("userId");
CREATE INDEX "CheckoutSession_status_idx" ON "public"."CheckoutSession"("status");
CREATE INDEX "CheckoutSession_expiresAt_idx" ON "public"."CheckoutSession"("expiresAt");

-- Foreign keys for the new tables
ALTER TABLE "public"."Vendor" ADD CONSTRAINT "Vendor_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Payout" ADD CONSTRAINT "Payout_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."VendorOrder" ADD CONSTRAINT "VendorOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."VendorOrder" ADD CONSTRAINT "VendorOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."VendorOrder" ADD CONSTRAINT "VendorOrder_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "public"."Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."VendorReview" ADD CONSTRAINT "VendorReview_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."VendorReview" ADD CONSTRAINT "VendorReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."VendorReview" ADD CONSTRAINT "VendorReview_vendorOrderId_fkey" FOREIGN KEY ("vendorOrderId") REFERENCES "public"."VendorOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------------- 3. Product: add columns nullable
ALTER TABLE "public"."Product"
    ADD COLUMN "vendorId" TEXT,
    ADD COLUMN "status" "public"."ProductStatus" NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN "rejectionReason" TEXT,
    ADD COLUMN "submittedAt" TIMESTAMP(3),
    ADD COLUMN "approvedAt" TIMESTAMP(3);

-- --------------------------------------------- 4. Backfill the legacy vendor
-- Existing products were created by the admin, so they are adopted by one
-- pre-approved store. Skipped entirely when there are no products to adopt.
DO $backfill_vendor$
DECLARE
    v_owner_id  TEXT;
    v_email     TEXT;
    v_phone     TEXT;
    v_vendor_id TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "public"."Product") THEN
        RAISE NOTICE 'No products to adopt — skipping legacy vendor backfill.';
        RETURN;
    END IF;

    -- Oldest ADMIN owns the legacy store; fall back to the oldest user so the
    -- migration cannot strand products on a database without an admin.
    SELECT u.id, a.email, COALESCE(u.phone, 'not-provided')
      INTO v_owner_id, v_email, v_phone
      FROM "public"."User" u
      JOIN "public"."Auth" a ON a."userId" = u.id
     WHERE a.role = 'ADMIN'
     ORDER BY a."createdAt" ASC, a.id ASC
     LIMIT 1;

    IF v_owner_id IS NULL THEN
        SELECT u.id, COALESCE(a.email, 'owner@example.invalid'), COALESCE(u.phone, 'not-provided')
          INTO v_owner_id, v_email, v_phone
          FROM "public"."User" u
          LEFT JOIN "public"."Auth" a ON a."userId" = u.id
         ORDER BY u."createdAt" ASC, u.id ASC
         LIMIT 1;
    END IF;

    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Cannot backfill vendor: products exist but there are no users to own the legacy store';
    END IF;

    v_vendor_id := gen_random_uuid()::TEXT;

    INSERT INTO "public"."Vendor" (
        "id", "ownerId", "storeName", "slug", "description",
        "status", "approvedAt", "businessEmail", "businessPhone",
        "createdAt", "updatedAt"
    ) VALUES (
        v_vendor_id, v_owner_id, 'Trendora Official', 'trendora-official',
        'The platform''s own store. Holds every product that existed before Trendora became a marketplace.',
        'APPROVED', NOW(), v_email, v_phone, NOW(), NOW()
    );

    -- Pre-marketplace products were already live, so they land APPROVED.
    UPDATE "public"."Product"
       SET "vendorId"    = v_vendor_id,
           "status"      = 'APPROVED',
           "submittedAt" = "createdAt",
           "approvedAt"  = NOW()
     WHERE "vendorId" IS NULL;

    RAISE NOTICE 'Adopted % product(s) into the legacy store %', (SELECT COUNT(*) FROM "public"."Product" WHERE "vendorId" = v_vendor_id), v_vendor_id;
END
$backfill_vendor$;

-- ------------------------------ 5. Product: enforce vendor + new constraints
ALTER TABLE "public"."Product" ALTER COLUMN "vendorId" SET NOT NULL;

-- Product names are unique PER VENDOR now: two stores may both sell
-- "Nike Air Max 90". The slug stays globally unique.
DROP INDEX "public"."Product_name_key";
CREATE UNIQUE INDEX "Product_vendorId_name_key" ON "public"."Product"("vendorId", "name");
CREATE INDEX "Product_vendorId_idx" ON "public"."Product"("vendorId");
CREATE INDEX "Product_status_idx" ON "public"."Product"("status");
CREATE INDEX "Product_vendorId_status_idx" ON "public"."Product"("vendorId", "status");
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------- 6. OrderItem / OrderStatusHistory: columns
ALTER TABLE "public"."OrderItem"
    ADD COLUMN "vendorOrderId" TEXT,
    ADD COLUMN "vendorId" TEXT;

ALTER TABLE "public"."OrderStatusHistory"
    ADD COLUMN "vendorOrderId" TEXT,
    ADD COLUMN "note" TEXT;

-- ------------------------------------------ 7. Backfill VendorOrders
-- Every historical order is split into one VendorOrder per distinct vendor in
-- its items. Legacy orders resolve to exactly one vendor (everything belongs
-- to the store created in step 4), but the loop handles the general case so
-- this migration is also correct on a database that already had several.
--
-- Tax and shipping are apportioned by subtotal share; any rounding residual is
-- pushed onto the first slice so the sum of the slices equals the order total
-- to the cent.
DO $backfill_vendor_orders$
DECLARE
    r_order       RECORD;
    r_group       RECORD;
    v_seq         INT;
    v_group_count INT;
    v_tax         NUMERIC(10,2);
    v_ship        NUMERIC(10,2);
    v_disc        NUMERIC(10,2);
    v_tax_used    NUMERIC(10,2);
    v_ship_used   NUMERIC(10,2);
    v_rate        NUMERIC(5,4);
    v_total       NUMERIC(10,2);
    v_commission  NUMERIC(10,2);
    v_vendor_order_id TEXT;
    v_first_id    TEXT;
    v_order_sub   NUMERIC(10,2);
BEGIN
    FOR r_order IN
        SELECT o.id, o."orderNumber", o.tax, o."shippingCost", o.discount, o."orderStatus"
          FROM "public"."Order" o
         WHERE EXISTS (SELECT 1 FROM "public"."OrderItem" oi WHERE oi."orderId" = o.id)
         ORDER BY o."createdAt"
    LOOP
        SELECT COUNT(*), COALESCE(SUM(sub), 0)
          INTO v_group_count, v_order_sub
          FROM (
            SELECT SUM(oi.subtotal) AS sub
              FROM "public"."OrderItem" oi
              JOIN "public"."Product" p ON p.id = oi."productId"
             WHERE oi."orderId" = r_order.id
             GROUP BY p."vendorId"
          ) g;

        v_seq       := 0;
        v_tax_used  := 0;
        v_ship_used := 0;
        v_first_id  := NULL;

        FOR r_group IN
            SELECT p."vendorId" AS vendor_id,
                   SUM(oi.subtotal)::NUMERIC(10,2) AS sub,
                   SUM(oi.discount)::NUMERIC(10,2) AS disc
              FROM "public"."OrderItem" oi
              JOIN "public"."Product" p ON p.id = oi."productId"
             WHERE oi."orderId" = r_order.id
             GROUP BY p."vendorId"
             ORDER BY p."vendorId"
        LOOP
            v_seq := v_seq + 1;

            IF v_group_count = 1 THEN
                v_tax  := r_order.tax;
                v_ship := r_order."shippingCost";
            ELSIF v_order_sub > 0 THEN
                v_tax  := ROUND(r_order.tax * (r_group.sub / v_order_sub), 2);
                v_ship := ROUND(r_order."shippingCost" * (r_group.sub / v_order_sub), 2);
            ELSE
                v_tax  := 0;
                v_ship := 0;
            END IF;

            -- `discount` is informational: item.priceAtPurchase is ALREADY the
            -- discounted price, so subtotal has it baked in and it must not be
            -- subtracted again. Invariant, matching src/helpers/order.ts:
            --   commissionAmount + vendorEarning == subtotal + shippingCost
            v_disc       := COALESCE(r_group.disc, 0);
            v_total      := r_group.sub + v_tax + v_ship;
            v_rate       := COALESCE((SELECT "commissionRate" FROM "public"."Vendor" WHERE id = r_group.vendor_id), 0.1000);
            v_commission := ROUND(r_group.sub * v_rate, 2);

            v_vendor_order_id := gen_random_uuid()::TEXT;
            IF v_first_id IS NULL THEN
                v_first_id := v_vendor_order_id;
            END IF;

            INSERT INTO "public"."VendorOrder" (
                "id", "orderId", "vendorId", "vendorOrderNumber",
                "subtotal", "tax", "shippingCost", "discount", "totalAmount",
                "commissionRate", "commissionAmount", "vendorEarning",
                "orderStatus", "createdAt", "updatedAt"
            ) VALUES (
                v_vendor_order_id, r_order.id, r_group.vendor_id,
                r_order."orderNumber" || '-V' || LPAD(v_seq::TEXT, 2, '0'),
                r_group.sub, v_tax, v_ship, v_disc, v_total,
                v_rate, v_commission, (r_group.sub + v_ship) - v_commission,
                r_order."orderStatus", NOW(), NOW()
            );

            UPDATE "public"."OrderItem" oi
               SET "vendorOrderId" = v_vendor_order_id,
                   "vendorId"      = r_group.vendor_id
              FROM "public"."Product" p
             WHERE p.id = oi."productId"
               AND oi."orderId" = r_order.id
               AND p."vendorId" = r_group.vendor_id;

            v_tax_used  := v_tax_used + v_tax;
            v_ship_used := v_ship_used + v_ship;
        END LOOP;

        -- Push the rounding residual onto the first slice.
        IF v_first_id IS NOT NULL
           AND (r_order.tax <> v_tax_used OR r_order."shippingCost" <> v_ship_used) THEN
            UPDATE "public"."VendorOrder"
               SET "tax"           = "tax" + (r_order.tax - v_tax_used),
                   "shippingCost"  = "shippingCost" + (r_order."shippingCost" - v_ship_used),
                   "totalAmount"   = "totalAmount"
                                     + (r_order.tax - v_tax_used)
                                     + (r_order."shippingCost" - v_ship_used),
                   "vendorEarning" = "vendorEarning" + (r_order."shippingCost" - v_ship_used)
             WHERE id = v_first_id;
        END IF;

        -- Existing history rows describe the whole order; when it resolved to a
        -- single vendor they also describe that vendor's fulfilment.
        IF v_group_count = 1 THEN
            UPDATE "public"."OrderStatusHistory"
               SET "vendorOrderId" = v_first_id
             WHERE "orderId" = r_order.id
               AND "vendorOrderId" IS NULL;
        END IF;
    END LOOP;
END
$backfill_vendor_orders$;

-- --------------------------- 8. OrderItem: enforce vendor + FKs and indexes
ALTER TABLE "public"."OrderItem" ALTER COLUMN "vendorOrderId" SET NOT NULL;
ALTER TABLE "public"."OrderItem" ALTER COLUMN "vendorId" SET NOT NULL;

CREATE INDEX "OrderItem_vendorOrderId_idx" ON "public"."OrderItem"("vendorOrderId");
CREATE INDEX "OrderItem_vendorId_idx" ON "public"."OrderItem"("vendorId");
CREATE INDEX "OrderStatusHistory_vendorOrderId_idx" ON "public"."OrderStatusHistory"("vendorOrderId");

ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_vendorOrderId_fkey" FOREIGN KEY ("vendorOrderId") REFERENCES "public"."VendorOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_vendorOrderId_fkey" FOREIGN KEY ("vendorOrderId") REFERENCES "public"."VendorOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
