-- AlterTable
ALTER TABLE "Bid" ADD COLUMN "address" TEXT,
ADD COLUMN "preBidMeetingAddress" TEXT,
ADD COLUMN "municipality" TEXT;

-- AlterTable
ALTER TABLE "EmailRecord" ADD COLUMN "bidMunicipality" TEXT;
