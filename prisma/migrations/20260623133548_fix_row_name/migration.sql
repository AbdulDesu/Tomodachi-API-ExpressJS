/*
  Warnings:

  - You are about to drop the column `duration` on the `Message` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Message" DROP COLUMN "duration",
ADD COLUMN     "durationMs" BIGINT;
