import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Turns a scraped Bid into a real Project (status BIDDING), linked back to the bid it came from. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const bid = await prisma.bid.findUnique({ where: { id: params.id } });
  if (!bid) {
    return NextResponse.json({ error: "Bid not found" }, { status: 404 });
  }

  const project = await prisma.project.create({
    data: {
      name: bid.title,
      client: bid.agency,
      projectType: bid.projectType,
      status: "BIDDING",
      bidId: bid.id,
    },
  });

  return NextResponse.json({ ok: true, project });
}
