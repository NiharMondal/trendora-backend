-- ============================================================================
-- Real gateway refunds
--
-- Until now, cancelling a paid parcel only *recorded* what the buyer was owed
-- (`Payment.refundAmount`); no money moved. This adds the ledger that backs an
-- actual Stripe refund:
--
--   * Refund              — one row per attempt to move money back to a buyer
--   * RefundStatus        — PENDING -> PROCESSING -> SUCCEEDED / FAILED
--   * PaymentStatus.PARTIALLY_REFUNDED — one parcel of three refunded is
--     neither PAID nor REFUNDED
--
-- `Payment.refundAmount` changes meaning: it used to be "accrued, owed to the
-- buyer" and is now "actually refunded" (the sum of SUCCEEDED refunds). Step 3
-- clears the old values, because no gateway refund has ever been performed —
-- leaving them would claim money went back when it did not. Nothing is lost:
-- what a buyer is owed is always derivable from the cancelled parcels.
-- ============================================================================

-- ------------------------------------------------------------------ 1. Enums
CREATE TYPE "public"."RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- Postgres forbids *using* a new enum value in the transaction that adds it.
-- Nothing below writes 'PARTIALLY_REFUNDED', so this is safe here.
ALTER TYPE "public"."PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- ------------------------------------------------------------- 2. New table
CREATE TABLE "public"."Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "vendorOrderId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "public"."RefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "gateway" TEXT,
    "gatewayRefundId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "gatewayResponse" JSONB,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- One refund per parcel: this is what stops a replayed cancel from creating a
-- second refund for the same goods.
CREATE UNIQUE INDEX "Refund_vendorOrderId_key" ON "public"."Refund"("vendorOrderId");
CREATE UNIQUE INDEX "Refund_gatewayRefundId_key" ON "public"."Refund"("gatewayRefundId");
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "public"."Refund"("idempotencyKey");
CREATE INDEX "Refund_orderId_idx" ON "public"."Refund"("orderId");
CREATE INDEX "Refund_paymentId_idx" ON "public"."Refund"("paymentId");
CREATE INDEX "Refund_status_idx" ON "public"."Refund"("status");
CREATE INDEX "Refund_createdAt_idx" ON "public"."Refund"("createdAt");

ALTER TABLE "public"."Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Refund" ADD CONSTRAINT "Refund_vendorOrderId_fkey" FOREIGN KEY ("vendorOrderId") REFERENCES "public"."VendorOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- --------------------------- 3. Reset the old accrued-refund bookkeeping
-- See the header: refundAmount now means "actually refunded", and no gateway
-- refund has ever run. `refundedAt` goes with it.
UPDATE "public"."Payment"
   SET "refundAmount" = NULL,
       "refundedAt"   = NULL
 WHERE "refundAmount" IS NOT NULL;
