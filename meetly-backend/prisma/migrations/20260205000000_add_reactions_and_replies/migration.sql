-- Add replyToId to messages for reply functionality
ALTER TABLE "messages" ADD COLUMN "replyToId" TEXT;

-- Add lastMessageId and lastMessageAt to chats for denormalization
ALTER TABLE "chats" ADD COLUMN "lastMessageId" TEXT;
ALTER TABLE "chats" ADD COLUMN "lastMessageAt" TIMESTAMP(3);

-- Create reactions table
CREATE TABLE "reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" VARCHAR(8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "messages" ADD CONSTRAINT "messages_replyToId_fkey" 
    FOREIGN KEY ("replyToId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chats" ADD CONSTRAINT "chats_lastMessageId_fkey" 
    FOREIGN KEY ("lastMessageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reactions" ADD CONSTRAINT "reactions_messageId_fkey" 
    FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reactions" ADD CONSTRAINT "reactions_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create unique constraint for one reaction per user per emoji per message
CREATE UNIQUE INDEX "reactions_messageId_userId_emoji_key" ON "reactions"("messageId", "userId", "emoji");

-- Create unique constraint for lastMessageId in chats
CREATE UNIQUE INDEX "chats_lastMessageId_key" ON "chats"("lastMessageId");

-- Create indexes for performance
CREATE INDEX "reactions_messageId_idx" ON "reactions"("messageId");
CREATE INDEX "reactions_userId_idx" ON "reactions"("userId");
CREATE INDEX "messages_replyToId_idx" ON "messages"("replyToId");
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");
CREATE INDEX "chats_lastMessageAt_idx" ON "chats"("lastMessageAt" DESC);
CREATE INDEX "users_phoneNumber_idx" ON "users"("phoneNumber");

-- Update existing indexes for better read performance
DROP INDEX IF EXISTS "message_reads_userId_messageId_idx";
CREATE INDEX "message_reads_userId_readAt_idx" ON "message_reads"("userId", "readAt" DESC);
CREATE INDEX "message_reads_messageId_idx" ON "message_reads"("messageId");

-- Update messages index for descending order
DROP INDEX IF EXISTS "messages_chatId_createdAt_idx";
CREATE INDEX "messages_chatId_createdAt_idx" ON "messages"("chatId", "createdAt" DESC);
