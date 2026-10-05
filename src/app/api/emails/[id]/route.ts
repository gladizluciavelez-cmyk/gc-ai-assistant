import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org";
import { emailVisibility } from "@/lib/visibility";
import { prisma } from "@/lib/prisma";

/**
 * PATCH an email record. Handles project assignment ({ projectId }) and manual
 * edits of the parsed bid/meeting fields from the Bid Opportunities page.
 * Any field omitted is left alone; empty string / null clears it.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { orgId } = ctx;

  const b = (await req.json()) as Record<string, string | null | undefined>;
  const text = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);

  const owned = await prisma.emailRecord.findFirst({ where: { AND: [emailVisibility(ctx), { id: params.id }] }, select: { id: true } });
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if ("projectId" in b) {
    if (b.projectId) {
      const project = await prisma.project.findFirst({ where: { id: b.projectId, orgId }, select: { id: true } });
      if (!project) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }
    data.projectId = b.projectId ?? null;
  }
  if ("projectNumber" in b) data.bidProjectNumber = text(b.projectNumber);
  if ("agency" in b) data.bidAgencyShort = text(b.agency);
  if ("scope" in b) data.bidSummary = text(b.scope);
  if ("address" in b) data.bidAddress = text(b.address);
  if ("municipality" in b) data.bidMunicipality = text(b.municipality);
  if ("meetingISO" in b) {
    data.meetingAt = b.meetingISO ? new Date(b.meetingISO) : null;
    data.addedToCalendar = false; // new/changed time needs re-confirming
  }
  if ("meetingAddress" in b) data.meetingAddress = text(b.meetingAddress);

  const email = await prisma.emailRecord.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true, email });
}
