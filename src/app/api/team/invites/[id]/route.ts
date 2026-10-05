import { NextResponse } from "next/server";
import { getOrgContext, isOwner } from "@/lib/org";
import { prisma } from "@/lib/prisma";

/** Owner revokes a pending invite. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isOwner(ctx)) {
    return NextResponse.json({ error: "Only owners can revoke invites" }, { status: 403 });
  }
  const result = await prisma.invite.deleteMany({
    where: { id: params.id, orgId: ctx.orgId, acceptedAt: null },
  });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
