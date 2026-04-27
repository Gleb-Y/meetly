-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('JOINED', 'LEFT', 'CONFIRMED');

-- AlterEnum
ALTER TYPE "EventStatus" ADD VALUE 'FINALIZED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "organizerRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "organizerRatingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalAttended" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'JOINED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizer_ratings" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizer_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendances_eventId_status_idx" ON "attendances"("eventId", "status");

-- CreateIndex
CREATE INDEX "attendances_userId_idx" ON "attendances"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_eventId_userId_key" ON "attendances"("eventId", "userId");

-- CreateIndex
CREATE INDEX "organizer_ratings_targetId_idx" ON "organizer_ratings"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "organizer_ratings_eventId_raterId_key" ON "organizer_ratings"("eventId", "raterId");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_ratings" ADD CONSTRAINT "organizer_ratings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_ratings" ADD CONSTRAINT "organizer_ratings_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_ratings" ADD CONSTRAINT "organizer_ratings_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
