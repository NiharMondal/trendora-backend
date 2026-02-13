/*
  Warnings:

  - You are about to drop the column `priceModifier` on the `ProductVariant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."ProductVariant" DROP COLUMN "priceModifier",
ADD COLUMN     "price" DECIMAL(10,2) NOT NULL DEFAULT 0;
