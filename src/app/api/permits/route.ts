import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { orgId } = ctx;

  const body = await req.json();
  const { projectId, name, status } = body as {
    projectId: string;
    name: string;
    status?: string;
  };

  if (!projectId || !name) {
    return NextResponse.json({ error: "projectId and name are required" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, orgId }, select: { id: true } });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
