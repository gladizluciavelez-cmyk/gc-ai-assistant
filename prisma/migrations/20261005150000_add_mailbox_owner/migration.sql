-- Mailbox attribution for privacy: which user's Gmail an email came from, and
-- which user a daily task belongs to. Existing rows stay NULL ("legacy"):
-- the org owner can still see them, and the email sync claims them for the
-- right user the next time that user's mailbox returns the same message.
ALTER TABLE "EmailRecord" ADD COLUMN "userId" TEXT;
ALTER TABLE "TaskItem" ADD COLUMN "userId" TEXT;

CREATE INDEX "EmailRecord_userId_idx" ON "EmailRecord"("userId");
CREATE INDEX "TaskItem_userId_idx" ON "TaskItem"("userId");

ALTER TABLE "EmailRecord" ADD CONSTRAINT "EmailRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskItem" ADD CONSTRAINT "TaskItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
