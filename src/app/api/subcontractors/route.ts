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
  const { name, trade, email, phone, projectId } = body as {
    name: string;
    trade?: string;
    email?: string;
    phone?: string;
    projectId?: string;
  };

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, orgId }, select: { id: true } });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const sub = await prisma.subcontractor.create({
    data: {
      orgId,
      name,
      trade,
      email,
      phone,
      ...(projectId && {
        projects: { create: [{ projectId }] },
      }),
    },
  });

  return NextResponse.json({ ok: true, subcontractor: sub });
}
