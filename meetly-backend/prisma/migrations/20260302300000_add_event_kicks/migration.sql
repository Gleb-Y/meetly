-- CreateTable
CREATE TABLE "event_kicks" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_kicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_kicks_userId_idx" ON "event_kicks"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_kicks_eventId_userId_key" ON "event_kicks"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "event_kicks" ADD CONSTRAINT "event_kicks_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_kicks" ADD CONSTRAINT "event_kicks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
