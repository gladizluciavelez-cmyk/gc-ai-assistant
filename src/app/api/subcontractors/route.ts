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

  const sub = await prisma.subcontractor.create({
    data: {
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
