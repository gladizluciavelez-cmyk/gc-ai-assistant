import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org";
import { prisma } from "@/lib/prisma";

/**
 * Manual edit of a scraped bid from the Bid Opportunities page. Scraped Bid
 * rows are shared public data, so edits are stored as this organization's
 * private BidOverride rather than changing the Bid itself.
 * Any field omitted is left alone; empty string / null clears it.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { orgId } = ctx;

  const bid = await prisma.bid.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!bid) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const b = (await req.json()) as Record<string, string | null | undefined>;
  const text = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);
  const date = (v: string | null | undefined) => (v ? new Date(v) : null);

  const data: Record<string, unknown> = {};
  if ("title" in b) data.title = text(b.title);
  if ("agency" in b) data.agency = text(b.agency);
  if ("municipality" in b) data.municipality = text(b.municipality);
  if ("address" in b) data.address = text(b.address);
  if ("scope" in b) data.projectType = text(b.scope);
  if ("dueISO" in b) data.openingDate = date(b.dueISO);
  if ("meetingISO" in b) {
    data.preBidMeetingAt = date(b.meetingISO);
    data.addedToCalendar = false; // new/changed time needs re-confirming
  }
  if ("meetingAddress" in b) data.preBidMeetingAddress = text(b.meetingAddress);

  const override = await prisma.bidOverride.upsert({
    where: { orgId_bidId: { orgId, bidId: bid.id } },
    create: { orgId, bidId: bid.id, ...data },
    update: data,
  });
  return NextResponse.json({ ok: true, override });
}
