import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { name, client, address, projectType, status, notes, startDate, targetDate } =
    body as Record<string, string | undefined>;

  const project = await prisma.project.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(client !== undefined && { client }),
      ...(address !== undefined && { address }),
      ...(projectType !== undefined && { projectType }),
      ...(status !== undefined && { status: status as never }),
      ...(notes !== undefined && { notes }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(targetDate !== undefined && { targetDate: targetDate ? new Date(targetDate) : null }),
    },
  });

  return NextResponse.json({ ok: true, project });
}
