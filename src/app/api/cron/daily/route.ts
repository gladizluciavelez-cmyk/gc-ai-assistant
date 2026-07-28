import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

/**
 * Entry point for Vercel Cron (see vercel.json). Runs once a day: generates
 * today's task plan for every connected user, and scrapes Miami-Dade bids.
 *
 * Gmail syncing is NOT triggered from here anymore — that's owned by the
 * separate gc-email-agent service, which has its own cron. Schedule that
 * service's cron to run before this one (see its README) so the emails it
 * writes are already there when task planning reads them.
 *
 * Protected by CRON_SECRET so this can't be triggered by randoms hitting
 * the URL — Vercel Cron sends this as a Bearer token automatically when
 * CRON_SECRET is set in project env vars.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const users = await prisma.user.findMany({ where: { googleConnected: true } });

  const results: Record<string, unknown> = {};

  for (const user of users) {
    try {
      const planRes = await fetch(`${baseUrl}/api/tasks/generate?userId=${user.id}`, {
        method: "POST",
      });
      results[user.id] = { plan: await planRes.json().catch(() => null) };
    } catch (err) {
      results[user.id] = { error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  const bidRes = await fetch(`${baseUrl}/api/scrape/miami-dade`, { method: "POST" }).catch(
    () => null
  );

  return NextResponse.json({
    ok: true,
    users: results,
    bids: bidRes ? await bidRes.json().catch(() => null) : null,
  });
}
