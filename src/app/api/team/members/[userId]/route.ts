import { NextResponse } from "next/server";
import { getOrgContext, isOwner } from "@/lib/org";
import { createSoloOrg } from "@/lib/org-create";
import { prisma } from "@/lib/prisma";
import { SHARED_EMAIL_CATEGORIES } from "@/lib/visibility";

/**
 * Owner removes a teammate. The company keeps its work data (bids, projects,
 * shared emails); the teammate's private mailbox data is purged, and they get a
 * fresh, empty company of their own so they can still sign in.
 */
export async function DELETE(_req: Request, { params }: { params: { userId: string } }) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isOwner(ctx)) {
    return NextResponse.json({ error: "Only owners can remove members" }, { status: 403 });
  }
  if (params.userId === ctx.userId) {
    return NextResponse.json({ error: "You can't remove yourself" }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id: params.userId, orgId: ctx.orgId },
    select: { id: true, name: true, email: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Their mailbox is private: purge the personal emails and daily plan that were
  // synced into this company. Work items (bid invites, meetings, anything filed
  // to a project) stay with the company, still attributed to who synced them.
  await prisma.$transaction([
    prisma.emailRecord.deleteMany({
      where: {
        orgId: ctx.orgId,
        userId: target.id,
        projectId: null,
        category: { notIn: [...SHARED_EMAIL_CATEGORIES] },
      },
    }),
    prisma.taskItem.deleteMany({ where: { orgId: ctx.orgId, userId: target.id } }),
  ]);

  await createSoloOrg(target.id, target.name, target.email);
  return NextResponse.json({ ok: true });
}
