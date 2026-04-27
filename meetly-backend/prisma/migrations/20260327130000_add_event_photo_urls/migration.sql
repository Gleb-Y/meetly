-- Add multi-photo support for events
ALTER TABLE "events"
ADD COLUMN "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill from legacy single photo field
UPDATE "events"
SET "photoUrls" = ARRAY["photoUrl"]
WHERE "photoUrl" IS NOT NULL;

-- Make default and not-null explicit after backfill
ALTER TABLE "events"
ALTER COLUMN "photoUrls" SET NOT NULL,
ALTER COLUMN "photoUrls" SET DEFAULT ARRAY[]::TEXT[];
