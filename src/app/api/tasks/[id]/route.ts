import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org";
import { taskVisibility } from "@/lib/visibility";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { status } = body as { status: "TODO" | "DONE" | "DISMISSED" };

  const result = await prisma.taskItem.updateMany({
    where: { id: params.id, ...taskVisibility(ctx) },
    data: { status },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
