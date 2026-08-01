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
  const { status } = body as { status: "TODO" | "DONE" | "DISMISSED" };

  const task = await prisma.taskItem.update({
    where: { id: params.id },
    data: { status },
  });

  return NextResponse.json({ ok: true, task });
}
