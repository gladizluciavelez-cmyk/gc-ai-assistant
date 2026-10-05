import type { Prisma } from "@prisma/client";
import type { OrgContext } from "@/lib/org";

/**
 * Privacy rules inside a company. Mailboxes are personal; only work items are
 * shared:
 *  - your own emails (userId = you)
 *  - bid invites and meetings (shared with the whole company)
 *  - any email linked to a project (someone deliberately filed it as work)
 *  - legacy emails with no recorded mailbox (userId null), owner only
 */
export const SHARED_EMAIL_CATEGORIES = ["BID_INVITE", "SCHEDULING"] as const;

export function emailVisibility(ctx: OrgContext): Prisma.EmailRecordWhereInput {
  return {
    orgId: ctx.orgId,
    OR: [
      { userId: ctx.userId },
      ...(ctx.role === "OWNER" ? [{ userId: null }] : []),
      { category: { in: [...SHARED_EMAIL_CATEGORIES] } },
      { projectId: { not: null } },
    ],
  };
}

/** Daily tasks are personal: your own, plus legacy (null) ones for the owner. */
export function taskVisibility(ctx: OrgContext): Prisma.TaskItemWhereInput {
  return {
    orgId: ctx.orgId,
    OR: [{ userId: ctx.userId }, ...(ctx.role === "OWNER" ? [{ userId: null }] : [])],
  };
}
