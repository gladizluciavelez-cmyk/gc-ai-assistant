import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org";
import { prisma } from "@/lib/prisma";

/** Turns a scraped Bid into a real Project (status BIDDING), linked back to the bid it came from. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { orgId } = ctx;

  const bid = await prisma.bid.findUnique({ where: { id: params.id } });
  if (!bid) {
    return NextResponse.json({ error: "Bid not found" }, { status: 404 });
  }

  // Use this org's own edits (if any) rather than the raw scraped values.
  const o = await prisma.bidOverride.findUnique({ where: { orgId_bidId: { orgId, bidId: bid.id } } });

  const project = await prisma.project.create({
    data: {
      orgId,
      name: o?.title ?? bid.title,
      client: o?.agency ?? bid.agency,
      address: o?.address ?? undefined,
      projectType: o?.projectType ?? bid.projectType,
      status: "BIDDING",
      bidId: bid.id,
    },
  });

  return NextResponse.json({ ok: true, project });
}
