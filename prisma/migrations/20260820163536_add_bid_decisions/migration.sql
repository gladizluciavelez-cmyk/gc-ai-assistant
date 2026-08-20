-- CreateEnum
CREATE TYPE "BidDecisionType" AS ENUM ('PLACED', 'SKIPPED');

-- AlterTable
ALTER TABLE "EmailRecord" ADD COLUMN     "bidAddress" TEXT,
ADD COLUMN     "bidAgencyShort" TEXT,
ADD COLUMN     "bidProjectNumber" TEXT,
ADD COLUMN     "bidSummary" TEXT;

-- CreateTable
CREATE TABLE "BidDecisionLog" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "decision" "BidDecisionType" NOT NULL,
    "reason" TEXT,
    "title" TEXT NOT NULL,
    "municipality" TEXT,
    "trade" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BidDecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BidDecisionLog_sourceType_sourceId_key" ON "BidDecisionLog"("sourceType", "sourceId");
