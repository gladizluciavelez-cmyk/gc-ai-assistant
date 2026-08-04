-- AlterTable
ALTER TABLE "EmailRecord" ADD COLUMN     "addedToCalendar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "meetingAddress" TEXT,
ADD COLUMN     "meetingAt" TIMESTAMP(3),
ADD COLUMN     "meetingTitle" TEXT;
