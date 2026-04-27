-- Remove attendance rows for event creators (organizer is not a check-in target).
DELETE FROM "attendances" a
USING "events" e
WHERE a."eventId" = e."id"
  AND a."userId" = e."creatorId";
