/*
  Warnings:

  - You are about to drop the column `slug` on the `Brand` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Brand_slug_idx";

-- DropIndex
DROP INDEX "public"."Brand_slug_key";

-- AlterTable
ALTER TABLE "public"."Brand" DROP COLUMN "slug";
