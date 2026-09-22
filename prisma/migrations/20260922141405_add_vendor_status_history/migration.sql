-- CreateTable
CREATE TABLE "public"."VendorStatusHistory" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "oldStatus" "public"."VendorStatus",
    "newStatus" "public"."VendorStatus" NOT NULL,
    "note" TEXT,
    "ipAddress" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorStatusHistory_vendorId_idx" ON "public"."VendorStatusHistory"("vendorId");

-- CreateIndex
CREATE INDEX "VendorStatusHistory_createdAt_idx" ON "public"."VendorStatusHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."VendorStatusHistory" ADD CONSTRAINT "VendorStatusHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VendorStatusHistory" ADD CONSTRAINT "VendorStatusHistory_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
