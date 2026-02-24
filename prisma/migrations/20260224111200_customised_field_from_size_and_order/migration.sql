-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "public"."Size" ALTER COLUMN "sizeGroupId" DROP NOT NULL;
