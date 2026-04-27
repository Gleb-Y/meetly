/*
  Warnings:

  - You are about to drop the column `phoneNumber` on the `verification_codes` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[googleId]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[appleId]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `identifier` to the `verification_codes` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "verification_codes_phoneNumber_idx";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "appleId" TEXT,
ADD COLUMN     "googleId" TEXT;

-- AlterTable
ALTER TABLE "verification_codes" DROP COLUMN "phoneNumber",
ADD COLUMN     "identifier" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_appleId_key" ON "users"("appleId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "verification_codes_identifier_idx" ON "verification_codes"("identifier");
