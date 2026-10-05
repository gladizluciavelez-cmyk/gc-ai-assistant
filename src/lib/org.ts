import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSoloOrg } from "@/lib/org-create";

export type OrgContext = { userId: string; orgId: string; role: "OWNER" | "MEMBER" };

/**
 * Resolves the signed-in user's organization (customer company) and role.
 * Every query of customer-owned data must filter by the returned orgId.
 *
 * New users normally get their own org at sign-up (see events.createUser in
 * auth.ts); this also creates one lazily if that hasn't happened yet, so a
 * signed-in user never ends up without a tenant.
 *
 * Returns null when nobody is signed in.
 */
export async function getOrgContext(): Promise<OrgContext | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return null;
  return orgForUser(userId);
}

export async function orgForUser(userId: string): Promise<OrgContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { orgId: true, role: true, name: true, email: true },
  });
  if (!user) return null;
  if (user.orgId) return { userId, orgId: user.orgId, role: user.role };
  const orgId = await createSoloOrg(userId, user.name, user.email);
  return { userId, orgId, role: "OWNER" };
}

/** Gate for owner-only actions (invites, removing members, billing). */
export function isOwner(ctx: OrgContext) {
  return ctx.role === "OWNER";
}
