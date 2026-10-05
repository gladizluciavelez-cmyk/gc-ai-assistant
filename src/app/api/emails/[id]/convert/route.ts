import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { detectTrade } from "@/lib/bid-tags";

/**
 * Turns a bid-invite email (e.g. an OpenGov notice) into a real Project
 * (status BIDDING) when the GC decides to bid on it, and links the email
 * to that new project so it drops out of "unassigned" lists.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { orgId } = ctx;

  const email = await prisma.emailRecord.findFirst({ where: { id: params.id, orgId } });
  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  const project = await prisma.project.create({
    data: {
      orgId,
      name: email.subject,
      client: email.from,
      projectType: detectTrade(`${email.subject} ${email.summary ?? ""}`),
      status: "BIDDING",
    },
  });

  await prisma.emailRecord.update({
    where: { id: email.id },
    data: { projectId: project.id },
  });

  return NextResponse.json({ ok: true, project });
}
