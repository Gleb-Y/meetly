-- Keep only one reaction per (messageId, userId), preferring latest record
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "messageId", "userId"
      ORDER BY "createdAt" DESC, id DESC
    ) AS rn
  FROM "reactions"
)
DELETE FROM "reactions"
WHERE id IN (
  SELECT id
  FROM ranked
  WHERE rn > 1
);

-- Replace old uniqueness by (messageId, userId, emoji) with (messageId, userId)
DROP INDEX IF EXISTS "reactions_messageId_userId_emoji_key";
CREATE UNIQUE INDEX IF NOT EXISTS "reactions_messageId_userId_key"
ON "reactions"("messageId", "userId");

-- Improve lookups for message reactions list
CREATE INDEX IF NOT EXISTS "reactions_messageId_idx"
ON "reactions"("messageId");
