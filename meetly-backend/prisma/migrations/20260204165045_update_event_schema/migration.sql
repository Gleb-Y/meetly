/*
  Warnings:

  - The values [gym,basketball,cocktail] on the enum `EventCategory` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `address` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `isPrivate` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `latitude` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `events` table. All the data in the column will be lost.
  - Added the required column `date` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `eventName` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `locationAddress` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `locationLatitude` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `locationLongitude` to the `events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `locationName` to the `events` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('public', 'private');

-- AlterEnum
BEGIN;
CREATE TYPE "EventCategory_new" AS ENUM ('party', 'sports', 'hoops', 'bar', 'food', 'music', 'art', 'outdoor');
ALTER TABLE "events" ALTER COLUMN "category" TYPE "EventCategory_new" USING ("category"::text::"EventCategory_new");
ALTER TYPE "EventCategory" RENAME TO "EventCategory_old";
ALTER TYPE "EventCategory_new" RENAME TO "EventCategory";
DROP TYPE "public"."EventCategory_old";
COMMIT;

-- DropIndex
DROP INDEX "events_isPrivate_idx";

-- AlterTable
ALTER TABLE "events" DROP COLUMN "address",
DROP COLUMN "isPrivate",
DROP COLUMN "latitude",
DROP COLUMN "longitude",
DROP COLUMN "title",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "endTime" TIMESTAMP(3),
ADD COLUMN     "eventName" VARCHAR(30) NOT NULL,
ADD COLUMN     "isAllDay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locationAddress" TEXT NOT NULL,
ADD COLUMN     "locationLatitude" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "locationLongitude" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "locationName" TEXT NOT NULL,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "startTime" TIMESTAMP(3),
ADD COLUMN     "visibility" "EventVisibility" NOT NULL DEFAULT 'public';

-- CreateIndex
CREATE INDEX "events_visibility_idx" ON "events"("visibility");
