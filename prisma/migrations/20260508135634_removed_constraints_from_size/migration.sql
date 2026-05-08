/*
  Warnings:

  - Made the column `sizeGroupId` on table `Size` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "public"."Size_name_key";

-- DropIndex
DROP INDEX "public"."Size_name_sizeGroupId_key";

-- DropIndex
DROP INDEX "public"."Size_sizeGroupId_idx";

-- AlterTable
ALTER TABLE "public"."Size" ALTER COLUMN "sizeGroupId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Size_name_idx" ON "public"."Size"("name");
