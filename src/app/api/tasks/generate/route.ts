import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";

export const maxDuration = 60;

interface PlanTask {
  title: string;
  description?: string;
  projectHint?: string;
  emailId?: string | null;
}

/**
 * Synthesizes "here's what to do today" from:
 *  - recent emails with an action item or that require a reply
 *  - open permits not yet approved
 *  - bids with a pre-bid meeting coming up in the next 7 days
 * Writes the result as TaskItem rows tagged with today's date so the
 * dashboard can just query planDate = today.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const url = new URL(req.url);
  const userId = session?.user
    ? (session.user as { id: string }).id
    : url.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const weekOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [emails, permits, upcomingBids, openTasks] = await Promise.all([
    prisma.emailRecord.findMany({
      where: {
        receivedAt: { gte: twoDaysAgo },
        OR: [{ requiresReply: true }, { NOT: { actionItem: null } }],
      },
      orderBy: { receivedAt: "desc" },
      take: 20,
    }),
    prisma.permit.findMany({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "NOT_SUBMITTED"] } },
      include: { project: true },
      take: 20,
    }),
    prisma.bid.findMany({
      where: { preBidMeetingAt: { gte: new Date(), lte: weekOut } },
      take: 10,
    }),
    prisma.taskItem.findMany({
      where: { status: "TODO" },
      take: 20,
    }),
  ]);

  if (!emails.length && !permits.length && !upcomingBids.length && !openTasks.length) {
    return NextResponse.json({ ok: true, tasks: [], note: "Nothing to plan yet." });
  }

  const context = JSON.stringify(
    {
      emails: emails.map((e) => ({
        id: e.id,
        from: e.from,
        subject: e.subject,
        category: e.category,
        summary: e.summary,
        actionItem: e.actionItem,
      })),
      openPermits: permits.map((p) => ({
        name: p.name,
        status: p.status,
        project: p.project?.name,
      })),
      upcomingPreBidMeetings: upcomingBids.map((b) => ({
        title: b.title,
        agency: b.agency,
        preBidMeetingAt: b.preBidMeetingAt,
      })),
      alreadyOpenTasks: openTasks.map((t) => t.title),
    },
    null,
    2
  );

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1200,
    system: `You are planning today's priorities for a general contractor (GC) based
on recent emails, open permits, and upcoming pre-bid meetings. Produce a short,
prioritized list of concrete tasks for today. Skip anything already in
"alreadyOpenTasks". Respond with ONLY a JSON array, no prose, shaped as:
[{"title": "...", "description": "...", "projectHint": "...", "emailId": "..."}]
"emailId" should be the "id" of the specific email in the "emails" list that this
task came from (copy it exactly), or null if the task isn't tied to one specific
email (e.g. it came from a permit or pre-bid meeting instead).
Keep it to at most 8 tasks, most urgent first.`,
    messages: [{ role: "user", content: context }],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => ("text" in b ? b.text : ""))
    .join("");

  let planTasks: PlanTask[] = [];
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    planTasks = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (err) {
    console.error("Failed to parse task plan", err, text);
    return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 });
  }

  // Only trust emailId values that actually match an email we sent Claude —
  // guards against a hallucinated id causing a foreign key error.
  const validEmailIds = new Set(emails.map((e) => e.id));

  const created = await prisma.$transaction(
    planTasks.map((t) =>
      prisma.taskItem.create({
        data: {
          title: t.title,
          description: t.description,
          source: "email",
          planDate: today,
          emailId: t.emailId && validEmailIds.has(t.emailId) ? t.emailId : null,
        },
      })
    )
  );

  return NextResponse.json({ ok: true, tasks: created });
}
