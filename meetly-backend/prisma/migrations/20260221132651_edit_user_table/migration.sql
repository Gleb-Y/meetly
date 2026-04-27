/*
  Warnings:

  - You are about to drop the column `appleId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `firstName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `googleId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "events_creatorId_idx";

-- DropIndex
DROP INDEX "friendships_friendId_idx";

-- DropIndex
DROP INDEX "friendships_userId_idx";

-- DropIndex
DROP INDEX "message_reads_messageId_idx";

-- DropIndex
DROP INDEX "messages_senderId_idx";

-- DropIndex
DROP INDEX "reactions_messageId_idx";

-- DropIndex
DROP INDEX "reactions_userId_idx";

-- DropIndex
DROP INDEX "users_appleId_key";

-- DropIndex
DROP INDEX "users_email_idx";

-- DropIndex
DROP INDEX "users_email_key";

-- DropIndex
DROP INDEX "users_googleId_key";

-- DropIndex
DROP INDEX "users_phoneNumber_idx";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "appleId",
DROP COLUMN "email",
DROP COLUMN "firstName",
DROP COLUMN "googleId",
DROP COLUMN "lastName",
DROP COLUMN "password";
