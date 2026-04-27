-- CreateEnum
CREATE TYPE "FriendsCountVisibility" AS ENUM ('EVERYONE', 'FRIENDS_ONLY', 'NOONE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "friendsCountVisibility" "FriendsCountVisibility" NOT NULL DEFAULT 'EVERYONE';
