/*
  Warnings:

  - The values [public,private] on the enum `EventVisibility` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EventVisibility_new" AS ENUM ('PUBLIC', 'PRIVATE');
ALTER TABLE "public"."events" ALTER COLUMN "visibility" DROP DEFAULT;
ALTER TABLE "events" ALTER COLUMN "visibility" TYPE "EventVisibility_new" USING ("visibility"::text::"EventVisibility_new");
ALTER TYPE "EventVisibility" RENAME TO "EventVisibility_old";
ALTER TYPE "EventVisibility_new" RENAME TO "EventVisibility";
DROP TYPE "public"."EventVisibility_old";
ALTER TABLE "events" ALTER COLUMN "visibility" SET DEFAULT 'PUBLIC';
COMMIT;

-- AlterTable
ALTER TABLE "events" ALTER COLUMN "visibility" SET DEFAULT 'PUBLIC';
