-- AlterEnum
ALTER TYPE "EventCategory" ADD VALUE 'custom';

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "customCategoryName" TEXT;
