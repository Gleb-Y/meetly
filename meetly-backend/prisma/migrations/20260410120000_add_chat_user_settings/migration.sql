-- CreateTable
CREATE TABLE "chat_user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_user_settings_userId_chatId_key" ON "chat_user_settings"("userId", "chatId");

-- CreateIndex
CREATE INDEX "chat_user_settings_userId_idx" ON "chat_user_settings"("userId");

-- CreateIndex
CREATE INDEX "chat_user_settings_chatId_idx" ON "chat_user_settings"("chatId");

-- AddForeignKey
ALTER TABLE "chat_user_settings" ADD CONSTRAINT "chat_user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_user_settings" ADD CONSTRAINT "chat_user_settings_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
