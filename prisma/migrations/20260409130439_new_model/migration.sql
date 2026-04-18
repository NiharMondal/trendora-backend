/*
  Warnings:

  - You are about to drop the column `provider` on the `Auth` table. All the data in the column will be lost.
  - You are about to drop the column `providerId` on the `Auth` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Auth_email_idx";

-- DropIndex
DROP INDEX "public"."Auth_providerId_key";

-- DropIndex
DROP INDEX "public"."Auth_role_idx";

-- AlterTable
ALTER TABLE "public"."Auth" DROP COLUMN "provider",
DROP COLUMN "providerId";

-- CreateTable
CREATE TABLE "public"."OAuthAccount" (
    "id" TEXT NOT NULL,
    "provider" "public"."AuthProvider" NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerId_key" ON "public"."OAuthAccount"("provider", "providerId");

-- AddForeignKey
ALTER TABLE "public"."OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
