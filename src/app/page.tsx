import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";
import { SignInScreen } from "@/components/SignInScreen";
import { SyncControls } from "@/components/SyncControls";
import { AssignProjectSelect } from "@/components/AssignProjectSelect";
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { ConfirmMeetingButton } from "@/components/ConfirmMeetingButton";
import {
  COMPANY_NAME,
  Card,
  EMAIL_CATEGORY,
  Empty,
  PageHeader,
  StatTile,
  Tag,
  gmailLink,
  shortDate,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const EMAILS_PER_PAGE = 10;
const EMAILS_TOTAL = 50;

// Email type tabs on the Recent Emails card. "General" is everything that
// isn't a bid invite or a meeting.
const EMAIL_TABS = [
  { key: "all", label: "All" },
  { key: "bid", label: "Bid Invite" },
  { key: "meeting", label: "Meeting" },
  { key: "general", label: "General" },
] as const;

function senderName(from: string) {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1] : from;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { emailPage?: string; type?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return <SignInScreen />;

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const type = EMAIL_TABS.some((t) => t.key === searchParams.type) ? searchParams.type! : "all";
  const categoryFilter =
    type === "bid"
      ? { category: "BID_INVITE" as const }
      : type === "meeting"
      ? { category: "SCHEDULING" as const }
      : type === "general"
      ? { category: { notIn: ["BID_INVITE" as const, "SCHEDULING" as const] } }
      : {};

  const [
    todayTasks,
    allRecentEmails,
    projects,
    pendingMeetings,
    openBids,
    openBidEmails,
    decisions,
    awaitingCount,
    meetingsThisWeek,
    lastEmail,
  ] = await Promise.all([
    prisma.taskItem.findMany({
      where: { planDate: today, status: "TODO" },
      orderBy: { createdAt: "asc" },
      include: { email: { select: { gmailId: true, from: true } } },
    }),
    prisma.emailRecord.findMany({
      where: categoryFilter,
      orderBy: { receivedAt: "desc" },
      take: EMAILS_TOTAL,
    }),
    prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.emailRecord.findMany({
      where: { meetingAt: { not: null }, addedToCalendar: false },
      orderBy: { meetingAt: "asc" },
    }),
    prisma.bid.findMany({ where: { project: null }, select: { id: true } }),
    prisma.emailRecord.findMany({
      where: { category: "BID_INVITE", project: null },
      select: { id: true },
    }),
    prisma.bidDecisionLog.findMany({ select: { sourceType: true, sourceId: true } }),
    // Bids we've placed that are still waiting on an award decision.
    prisma.project.count({ where: { status: "BIDDING" } }),
    prisma.emailRecord.findMany({
      where: { meetingAt: { gte: now, lte: weekOut } },
      orderBy: { meetingAt: "asc" },
      select: { meetingAt: true, meetingTitle: true, subject: true },
    }),
    prisma.emailRecord.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  const decided = new Set(decisions.map((d) => `${d.sourceType}-${d.sourceId}`));
  const activeBidCount =
    openBids.filter((b) => !decided.has(`bid-${b.id}`)).length +
    openBidEmails.filter((e) => !decided.has(`email-${e.id}`)).length;

  const totalEmailPages = Math.max(1, Math.ceil(allRecentEmails.length / EMAILS_PER_PAGE));
  const emailPage = Math.min(
    Math.max(Number(searchParams.emailPage ?? "1") || 1, 1),
    totalEmailPages
  );
  const recentEmails = allRecentEmails.slice(
    (emailPage - 1) * EMAILS_PER_PAGE,
    emailPage * EMAILS_PER_PAGE
  );
  const pageHref = (p: number) => `/?${new URLSearchParams({ type, emailPage: String(p) })}`;

  const nextMeeting = meetingsThisWeek[0];
  const todayLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <AppShell user={session.user}>
      <PageHeader
        eyebrow={COMPANY_NAME}
        title="Email Tracking"
        subtitle={
          <>
            {todayLabel}
            {lastEmail && <> · Last synced {shortDate(lastEmail.createdAt)}</>} · Signed in as{" "}
            {session.user.email}
          </>
        }
        actions={<SyncControls />}
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Active bids tracked"
          value={activeBidCount}
          note={
            <Link href="/bid-opportunities" className="text-brand-600 hover:underline">
              Open Bid Opportunities →
            </Link>
          }
        />
        <StatTile
          label="Awaiting response"
          value={awaitingCount}
          note="Bids placed, no award yet"
          dot="bg-amber-500"
        />
        <StatTile
          label="Pre-bid meetings this week"
          value={meetingsThisWeek.length}
          note={
            nextMeeting?.meetingAt
              ? `Next: ${nextMeeting.meetingAt.toLocaleString("en-US", {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })} · ${nextMeeting.meetingTitle ?? nextMeeting.subject}`
              : "None scheduled"
          }
          dot="bg-violet-600"
        />
      </div>

      {pendingMeetings.length > 0 && (
        <section className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-base font-semibold text-amber-900">Pre-bid meetings to confirm</h2>
          <p className="mb-3 text-sm text-amber-800">
            Found in email text — confirm to add them to your Google Calendar.
          </p>
          <ul className="space-y-2">
            {pendingMeetings.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{m.meetingTitle ?? m.subject}</p>
                  <p className="text-sm text-slate-600">
                    {m.meetingAt?.toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    {m.meetingAddress ? ` · ${m.meetingAddress}` : ""}
                  </p>
                  <a
                    href={gmailLink(m.gmailId)}
                    target="_blank"
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    ↗ View email
                  </a>
                </div>
                <ConfirmMeetingButton
                  emailId={m.id}
                  title={m.meetingTitle ?? m.subject}
                  startISO={m.meetingAt!.toISOString()}
                  location={m.meetingAddress}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <Card
          title="Today's Plan"
          subtitle={`${todayTasks.length} open task${todayTasks.length === 1 ? "" : "s"}, built from your inbox`}
        >
          {todayTasks.length === 0 ? (
            <Empty text="No plan generated yet — click “Generate Today's Plan.”" />
          ) : (
            <ul className="space-y-2.5">
              {todayTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5"
                >
                  <TaskCheckbox taskId={t.id} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-5">{t.title}</p>
                    {t.description && (
                      <p className="mt-0.5 text-[13px] text-slate-500">{t.description}</p>
                    )}
                    {t.email?.gmailId && (
                      <a
                        href={gmailLink(t.email.gmailId)}
                        target="_blank"
                        className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline"
                      >
                        ↗ Email · {senderName(t.email.from)}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Recent Emails"
          subtitle="Auto-sorted by the assistant"
          action={
            <div className="flex shrink-0 gap-1 rounded-lg bg-slate-100 p-1">
              {EMAIL_TABS.map((t) => (
                <Link
                  key={t.key}
                  href={`/?type=${t.key}`}
                  className={`rounded-md px-2.5 py-1 text-xs ${
                    t.key === type
                      ? "bg-white font-semibold text-slate-900 shadow-sm"
                      : "font-medium text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          }
        >
          {recentEmails.length === 0 ? (
            <Empty text="No emails here yet — click “Sync Gmail.”" />
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(0,1fr)_96px_160px_64px] gap-4 border-b border-slate-200 px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:grid">
                <span>Email</span>
                <span>Type</span>
                <span>Project</span>
                <span className="text-right">Received</span>
              </div>
              <ul>
                {recentEmails.map((e) => {
                  const cat = EMAIL_CATEGORY[e.category] ?? EMAIL_CATEGORY.OTHER;
                  return (
                    <li
                      key={e.id}
                      className="grid grid-cols-1 gap-2 border-b border-slate-100 px-1 py-3 last:border-0 md:grid-cols-[minmax(0,1fr)_96px_160px_64px] md:items-center md:gap-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold">{senderName(e.from)}</p>
                        <a
                          href={gmailLink(e.gmailId)}
                          target="_blank"
                          className="block truncate text-[13px] text-slate-600 hover:underline"
                          title={e.summary ?? e.subject}
                        >
                          {e.subject}
                        </a>
                        {e.actionItem && (
                          <p className="truncate text-xs text-brand-700">→ {e.actionItem}</p>
                        )}
                      </div>
                      <div>
                        <Tag tone={cat.tone}>{cat.label}</Tag>
                      </div>
                      <AssignProjectSelect
                        emailId={e.id}
                        currentProjectId={e.projectId}
                        projects={projects}
                      />
                      <span className="text-xs text-slate-500 md:text-right">
                        {shortDate(e.receivedAt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex items-center gap-1.5">
                <span className="mr-auto text-xs text-slate-500">
                  Showing {(emailPage - 1) * EMAILS_PER_PAGE + 1}–
                  {(emailPage - 1) * EMAILS_PER_PAGE + recentEmails.length} of{" "}
                  {allRecentEmails.length}
                </span>
                {totalEmailPages > 1 &&
                  Array.from({ length: totalEmailPages }, (_, i) => i + 1).map((p) => (
                    <Link
                      key={p}
                      href={pageHref(p)}
                      className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium ${
                        p === emailPage
                          ? "bg-brand-600 text-white"
                          : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {p}
                    </Link>
                  ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
