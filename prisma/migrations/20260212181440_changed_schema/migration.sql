/*
  Warnings:

  - You are about to drop the column `cancelReason` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `canceledAt` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `deliveredAt` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `discount` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `estimatedDelivery` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `shippingCost` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `subtotal` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `tax` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `trackingNumber` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `discount` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `originalPrice` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `priceAtPurchase` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `subtotal` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `variantDetails` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `changedBy` on the `OrderStatusHistory` table. All the data in the column will be lost.
  - You are about to drop the column `ipAddress` on the `OrderStatusHistory` table. All the data in the column will be lost.
  - You are about to drop the column `reason` on the `OrderStatusHistory` table. All the data in the column will be lost.
  - You are about to drop the column `sortOrder` on the `ProductImage` table. All the data in the column will be lost.
  - You are about to drop the column `sku` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the `InventoryLog` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `price` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Made the column `size` on table `ProductVariant` required. This step will fail if there are existing NULL values in that column.
  - Made the column `color` on table `ProductVariant` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MEN', 'WOMEN', 'KIDS', 'UNISEX');

-- DropForeignKey
ALTER TABLE "public"."InventoryLog" DROP CONSTRAINT "InventoryLog_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."InventoryLog" DROP CONSTRAINT "InventoryLog_variantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderStatusHistory" DROP CONSTRAINT "OrderStatusHistory_changedBy_fkey";

-- DropIndex
DROP INDEX "public"."ProductVariant_sku_idx";

-- DropIndex
DROP INDEX "public"."ProductVariant_sku_key";

-- AlterTable
ALTER TABLE "public"."Order" DROP COLUMN "cancelReason",
DROP COLUMN "canceledAt",
DROP COLUMN "deliveredAt",
DROP COLUMN "discount",
DROP COLUMN "estimatedDelivery",
DROP COLUMN "shippingCost",
DROP COLUMN "subtotal",
DROP COLUMN "tax",
DROP COLUMN "trackingNumber",
DROP COLUMN "userAgent";

-- AlterTable
ALTER TABLE "public"."OrderItem" DROP COLUMN "discount",
DROP COLUMN "originalPrice",
DROP COLUMN "priceAtPurchase",
DROP COLUMN "subtotal",
DROP COLUMN "variantDetails",
ADD COLUMN     "price" DECIMAL(10,2) NOT NULL;

-- AlterTable
ALTER TABLE "public"."OrderStatusHistory" DROP COLUMN "changedBy",
DROP COLUMN "ipAddress",
DROP COLUMN "reason";

-- AlterTable
ALTER TABLE "public"."ProductImage" DROP COLUMN "sortOrder";

-- AlterTable
ALTER TABLE "public"."ProductVariant" DROP COLUMN "sku",
ALTER COLUMN "size" SET NOT NULL,
ALTER COLUMN "color" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "avatar" DROP DEFAULT;

-- DropTable
DROP TABLE "public"."InventoryLog";

-- DropEnum
DROP TYPE "public"."InventoryType";

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "public"."Product"("name");
