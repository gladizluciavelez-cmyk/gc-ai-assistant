import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { orgId } = ctx;

  const body = await req.json();
  const { status } = body as { status: string };

  const owned = await prisma.permit.findFirst({
    where: { id: params.id, project: { orgId } },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const permit = await prisma.permit.update({
    where: { id: params.id },
    data: {
      status: status as never,
      ...(status === "APPROVED" && { approvedAt: new Date() }),
      ...(status === "SUBMITTED" && { submittedAt: new Date() }),
    },
  });

  return NextResponse.json({ ok: true, permit });
}
