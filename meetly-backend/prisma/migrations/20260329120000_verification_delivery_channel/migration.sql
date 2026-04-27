-- CreateEnum
CREATE TYPE "VerificationDeliveryChannel" AS ENUM ('SMS', 'TELEGRAM_GATEWAY');

-- AlterTable
ALTER TABLE "verification_codes" ADD COLUMN     "deliveryChannel" "VerificationDeliveryChannel",
ADD COLUMN     "telegramRequestId" TEXT;
