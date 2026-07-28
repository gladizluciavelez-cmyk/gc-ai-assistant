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
      name,
      client,
      address,
      projectType,
      status: (status as never) ?? "BIDDING",
    },
  });

  return NextResponse.json({ ok: true, project });
}
