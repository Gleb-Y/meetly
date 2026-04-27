ALTER TABLE "messages"
ADD COLUMN "audioUrl" TEXT,
ADD COLUMN "audioDurationMs" INTEGER,
ADD COLUMN "audioMimeType" TEXT,
ADD COLUMN "audioSizeBytes" INTEGER;
