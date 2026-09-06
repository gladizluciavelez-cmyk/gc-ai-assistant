import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const maxDuration = 30;

/**
 * Thin proxy — the actual Gmail reading/classification logic moved to the
 * separate gc-email-agent service (its own Vercel deployment, own cron).
 * This route just authenticates the dashboard user, then makes a
 * server-to-server call to that service using a shared secret so the
 * "Sync Gmail" button in the UI keeps working exactly as before.
 *
 * Requires env vars: EMAIL_AGENT_URL (e.g. https://gc-email-agent.vercel.app)
 * and AGENT_SHARED_SECRET (must match the value set in that service's env vars).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const agentUrl = process.env.EMAIL_AGENT_URL;
  const sharedSecret = process.env.AGENT_SHARED_SECRET;

  if (!agentUrl || !sharedSecret) {
    return NextResponse.json(
      {
        error:
          "EMAIL_AGENT_URL / AGENT_SHARED_SECRET not configured — see README " +
          "for wiring this app up to the gc-email-agent service.",
      },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const days = url.searchParams.get("days") ?? "2";

  try {
    const res = await fetch(
      `${agentUrl}/api/sync?userId=${encodeURIComponent(userId)}&days=${days}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${sharedSecret}` },
      }
    );

    // The email agent can crash hard enough (timeout, unhandled exception)
    // that it returns an empty or non-JSON body — calling res.json() on that
    // throws "Unexpected end of JSON input" and hides the real error. Read
    // the raw text first so we can always surface something readable.
    const rawText = await res.text();
    let data: unknown;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = { error: rawText || `Email agent returned an empty response (status ${res.status}).` };
    }

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Failed to reach gc-email-agent", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error reaching email agent" },
      { status: 502 }
    );
  }
}
