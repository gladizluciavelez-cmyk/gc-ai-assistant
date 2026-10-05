import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getOrgContext, isOwner } from "@/lib/org";
import { prisma } from "@/lib/prisma";

const INVITE_DAYS = 7;

/** Owner creates a single-use invite link (optionally locked to one email). */
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isOwner(ctx)) {
    return NextResponse.json({ error: "Only owners can invite teammates" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "That doesn't look like a valid email" }, { status: 400 });
  }

  const invite = await prisma.invite.create({
    data: {
      orgId: ctx.orgId,
      email,
      token: randomBytes(24).toString("hex"),
      role: "MEMBER",
      expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
      createdById: ctx.userId,
    },
  });

  const base = process.env.NEXTAUTH_URL ?? new URL(req.url).origin;
  return NextResponse.json({ ok: true, invite, link: `${base}/join/${invite.token}` });
}
