-- Team roles and invitations.
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'MEMBER');

ALTER TABLE "User" ADD COLUMN "role" "OrgRole" NOT NULL DEFAULT 'MEMBER';

-- The earliest user in each existing organization becomes its owner.
UPDATE "User" SET "role" = 'OWNER'
WHERE "id" IN (
  SELECT DISTINCT ON ("orgId") "id" FROM "User"
  WHERE "orgId" IS NOT NULL
  ORDER BY "orgId", "createdAt" ASC
);

-- Name the pilot customer's org (was created as "Default Organization").
UPDATE "Organization" SET "name" = 'Regosa Engineering Services, Inc.' WHERE "id" = 'org_default';

CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT,
    "token" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");
CREATE INDEX "Invite_orgId_idx" ON "Invite"("orgId");
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
