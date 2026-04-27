-- Participant karma baseline: new default 5; backfill legacy zeros only.
ALTER TABLE "users" ALTER COLUMN "rating" SET DEFAULT 5;

UPDATE "users" SET "rating" = 5 WHERE "rating" = 0;
