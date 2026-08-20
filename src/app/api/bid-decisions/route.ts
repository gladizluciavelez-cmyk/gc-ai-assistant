import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Logs a "Placed Bid" or "Skip" decision on a Bid Opportunity (whichever
 * source it came from — a scraped Bid row or a BID_INVITE EmailRecord).
 * One decision per (sourceType, sourceId); calling this again overwrites
 * the previous decision rather than duplicating rows.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { sourceType, sourceId, decision, reason, title, municipality, trade } = body as {
    sourceType: "bid" | "email";
    sourceId: string;
    decision: "PLACED" | "SKIPPED";
    reason?: string | null;
    title: string;
    municipality?: string | null;
    trade?: string | null;
  };

  if (!sourceType || !sourceId || !decision || !title) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const log = await prisma.bidDecisionLog.upsert({
    where: { sourceType_sourceId: { sourceType, sourceId } },
    create: {
      sourceType,
      sourceId,
      decision,
      reason: decision === "SKIPPED" ? reason ?? null : null,
      title,
      municipality: municipality ?? null,
      trade: trade ?? null,
    },
    update: {
      decision,
      reason: decision === "SKIPPED" ? reason ?? null : null,
    },
  });

  return NextResponse.json({ ok: true, log });
}
