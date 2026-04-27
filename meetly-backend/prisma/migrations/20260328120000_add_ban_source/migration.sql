-- CreateEnum
CREATE TYPE "BanSource" AS ENUM ('NONE', 'REPORTS', 'ADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "banSource" "BanSource" NOT NULL DEFAULT 'NONE';
