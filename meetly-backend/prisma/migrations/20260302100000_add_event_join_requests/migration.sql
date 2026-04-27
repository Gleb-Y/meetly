-- CreateEnum
CREATE TYPE "EventJoinRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "event_join_requests" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EventJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_join_requests_eventId_status_idx" ON "event_join_requests"("eventId", "status");

-- CreateIndex
CREATE INDEX "event_join_requests_userId_status_idx" ON "event_join_requests"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "event_join_requests_eventId_userId_key" ON "event_join_requests"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "event_join_requests" ADD CONSTRAINT "event_join_requests_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_join_requests" ADD CONSTRAINT "event_join_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
