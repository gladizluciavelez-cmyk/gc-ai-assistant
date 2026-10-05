import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { orgForUser } from "@/lib/org";
import { prisma } from "@/lib/prisma";

/**
 * Accepts an invite for the signed-in user: moves them into the inviting
 * company and deletes the empty solo company they were auto-created at sign-up.
 * Refuses if the user's current company already has data or other members, so
 * accepting an invite can never destroy anything.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token) return NextResponse.json({ error: "Missing invite token" }, { status: 400 });

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "This invite is invalid, already used, or expired. Ask for a new one." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (invite.email && invite.email !== user?.email?.toLowerCase()) {
    return NextResponse.json(
      { error: `This invite was sent to ${invite.email}. Sign in with that Google account.` },
      { status: 403 }
    );
  }

  const current = await orgForUser(userId);
  if (!current) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  if (current.orgId === invite.orgId) {
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  const old = current.orgId;
  const [others, projects, subs, emails, tasks, decisions, overrides] = await Promise.all([
    prisma.user.count({ where: { orgId: old, NOT: { id: userId } } }),
    prisma.project.count({ where: { orgId: old } }),
    prisma.subcontractor.count({ where: { orgId: old } }),
    prisma.emailRecord.count({ where: { orgId: old } }),
    prisma.taskItem.count({ where: { orgId: old } }),
    prisma.bidDecisionLog.count({ where: { orgId: old } }),
    prisma.bidOverride.count({ where: { orgId: old } }),
  ]);
  if (others + projects + subs + emails + tasks + decisions + overrides > 0) {
    return NextResponse.json(
      {
        error:
          "This account already has its own company with data or members, so it can't be merged automatically. Use a different Google account, or contact support.",
      },
      { status: 409 }
    );
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { orgId: invite.orgId, role: invite.role } }),
    prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date(), acceptedById: userId },
    }),
    prisma.organization.delete({ where: { id: old } }),
  ]);

  return NextResponse.json({ ok: true });
}
