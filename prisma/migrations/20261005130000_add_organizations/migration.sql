-- Multi-tenancy: Organization + orgId on customer-owned tables, and
-- per-org BidOverride (replaces the shared manual-edit columns on Bid).
-- Existing users and data are all assigned to one "Default Organization"
-- so current behavior is preserved; new sign-ups get their own org.

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Organization" ("id", "name") VALUES ('org_default', 'Default Organization');

ALTER TABLE "User" ADD COLUMN "orgId" TEXT;
ALTER TABLE "Project" ADD COLUMN "orgId" TEXT;
ALTER TABLE "Subcontractor" ADD COLUMN "orgId" TEXT;
ALTER TABLE "EmailRecord" ADD COLUMN "orgId" TEXT;
ALTER TABLE "TaskItem" ADD COLUMN "orgId" TEXT;
ALTER TABLE "BidDecisionLog" ADD COLUMN "orgId" TEXT;

UPDATE "User" SET "orgId" = 'org_default';
UPDATE "Project" SET "orgId" = 'org_default';
UPDATE "Subcontractor" SET "orgId" = 'org_default';
UPDATE "EmailRecord" SET "orgId" = 'org_default';
UPDATE "TaskItem" SET "orgId" = 'org_default';
UPDATE "BidDecisionLog" SET "orgId" = 'org_default';

ALTER TABLE "BidDecisionLog" ALTER COLUMN "orgId" SET NOT NULL;

-- Project.bidId was globally unique; now unique per org.
DROP INDEX IF EXISTS "Project_bidId_key";
CREATE UNIQUE INDEX "Project_orgId_bidId_key" ON "Project"("orgId", "bidId");

-- Decisions are unique per org. The old global unique index is dropped in the
-- same step; deploy the new code right after migrating.
DROP INDEX IF EXISTS "BidDecisionLog_sourceType_sourceId_key";
CREATE UNIQUE INDEX "BidDecisionLog_orgId_sourceType_sourceId_key" ON "BidDecisionLog"("orgId", "sourceType", "sourceId");

CREATE INDEX "User_orgId_idx" ON "User"("orgId");
CREATE INDEX "Project_orgId_idx" ON "Project"("orgId");
CREATE INDEX "Subcontractor_orgId_idx" ON "Subcontractor"("orgId");
CREATE INDEX "EmailRecord_orgId_idx" ON "EmailRecord"("orgId");
CREATE INDEX "TaskItem_orgId_idx" ON "TaskItem"("orgId");
CREATE INDEX "BidDecisionLog_orgId_idx" ON "BidDecisionLog"("orgId");

ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Subcontractor" ADD CONSTRAINT "Subcontractor_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailRecord" ADD CONSTRAINT "EmailRecord_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskItem" ADD CONSTRAINT "TaskItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BidDecisionLog" ADD CONSTRAINT "BidDecisionLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Per-org overrides of shared scraped bids.
CREATE TABLE "BidOverride" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "title" TEXT,
    "agency" TEXT,
    "municipality" TEXT,
    "address" TEXT,
    "projectType" TEXT,
    "openingDate" TIMESTAMP(3),
    "preBidMeetingAt" TIMESTAMP(3),
    "preBidMeetingAddress" TEXT,
    "addedToCalendar" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BidOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BidOverride_orgId_bidId_key" ON "BidOverride"("orgId", "bidId");
ALTER TABLE "BidOverride" ADD CONSTRAINT "BidOverride_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BidOverride" ADD CONSTRAINT "BidOverride_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove the shared manual-edit columns added in 20261005120000 (they would
-- have leaked one customer's edits to everyone). Edits now live in BidOverride.
ALTER TABLE "Bid" DROP COLUMN IF EXISTS "address";
ALTER TABLE "Bid" DROP COLUMN IF EXISTS "preBidMeetingAddress";
ALTER TABLE "Bid" DROP COLUMN IF EXISTS "municipality";
