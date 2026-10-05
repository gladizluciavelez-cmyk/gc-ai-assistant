-- Emails with a Date header in the future (sender clock/typo) were pinned to
-- the top of the newest-first lists. Use the time we actually received them.
UPDATE "EmailRecord" SET "receivedAt" = "createdAt" WHERE "receivedAt" > NOW();
