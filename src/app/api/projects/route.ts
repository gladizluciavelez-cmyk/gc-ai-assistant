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
  const { name, client, address, projectType, status } = body as {
    name: string;
    client?: string;
    address?: string;
    projectType?: string;
    status?: string;
  };

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      orgId,
      name,
      client,
      address,
      projectType,
      status: (status as never) ?? "BIDDING",
    },
  });

  return NextResponse.json({ ok: true, project });
}
