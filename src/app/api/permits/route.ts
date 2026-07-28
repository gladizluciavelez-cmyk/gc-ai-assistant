import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { projectId, name, status } = body as {
    projectId: string;
    name: string;
    status?: string;
  };

  if (!projectId || !name) {
    return NextResponse.json({ error: "projectId and name are required" }, { status: 400 });
  }

  const permit = await prisma.permit.create({
    data: {
      projectId,
      name,
      status: (status as never) ?? "NOT_SUBMITTED",
    },
  });

  return NextResponse.json({ ok: true, permit });
}
