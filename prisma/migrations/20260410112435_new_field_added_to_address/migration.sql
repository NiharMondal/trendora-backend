/*
  Warnings:

  - Added the required column `email` to the `Address` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Address" ADD COLUMN     "email" TEXT NOT NULL;
