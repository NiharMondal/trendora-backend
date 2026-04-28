-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_shippingAddressId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Size" DROP CONSTRAINT "Size_sizeGroupId_fkey";

-- AddForeignKey
ALTER TABLE "public"."Size" ADD CONSTRAINT "Size_sizeGroupId_fkey" FOREIGN KEY ("sizeGroupId") REFERENCES "public"."SizeGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "public"."Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
