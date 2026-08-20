import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignInButton, SignOutButton } from "@/components/AuthButton";
import { SyncControls } from "@/components/SyncControls";
import { AssignProjectSelect } from "@/components/AssignProjectSelect";
import { ConvertBidButton } from "@/components/ConvertBidButton";
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { ConfirmMeetingButton } from "@/components/ConfirmMeetingButton";
import { ConvertEmailButton } from "@/components/ConvertEmailButton";
import { detectMunicipality, detectTrade } from "@/lib/bid-tags";

export const dynamic = "force-dynamic";

const EMAILS_PER_PAGE = 25;
const EMAILS_TOTAL = 50;

function gmailLink(gmailId: string) {
  return `https://mail.google.com/mail/u/0/#all/${gmailId}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { emailPage?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
        <h1 className="text-2xl font-semibold">Regosa Engineering Services, Inc.</h1>
        <p className="text-slate-600">
          Connect your Google account to let the assistant read your inbox for
          project/subcontractor/permit updates and create calendar events for
          pre-bid meetings.
        </p>
        <SignInButton />
      </main>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const emailPage = Math.min(
    Math.max(Number(searchParams.emailPage ?? "1") || 1, 1),
    Math.ceil(EMAILS_TOTAL / EMAILS_PER_PAGE)
  );

  const [
    todayTasks,
    allRecentEmails,
    openPermits,
    recentBids,
    bidInviteEmails,
    projects,
    pendingMeetings,
  ] = await Promise.all([
    prisma.taskItem.findMany({
      where: { planDate: today, status: "TODO" },
      orderBy: { createdAt: "asc" },
      include: { email: { select: { gmailId: true } } },
    }),
    prisma.emailRecord.findMany({
      orderBy: { receivedAt: "desc" },
      take: EMAILS_TOTAL,
    }),
    prisma.permit.findMany({
      where: { status: { not: "APPROVED" } },
      include: { project: true },
      take: 10,
    }),
    prisma.bid.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      where: { project: null },
    }),
    prisma.emailRecord.findMany({
      where: { category: "BID_INVITE", project: null },
      orderBy: { receivedAt: "desc" },
      take: 10,
    }),
    prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.emailRecord.findMany({
      where: { meetingAt: { not: null }, addedToCalendar: false },
      orderBy: { meetingAt: "asc" },
    }),
  ]);

  const totalEmailPages = Math.max(1, Math.ceil(allRecentEmails.length / EMAILS_PER_PAGE));
  const recentEmails = allRecentEmails.slice(
    (emailPage - 1) * EMAILS_PER_PAGE,
    emailPage * EMAILS_PER_PAGE
  );

  // Merge scraped bids (Miami-Dade, DemandStar, etc.) and bid-invite emails
  // (OpenGov and similar) into one "Bid Opportunities" feed, newest first,
  // each tagged with where it came from.
  type BidOpportunity =
    | {
        kind: "bid";
        id: string;
        date: Date;
        title: string;
        subtitle: string;
        url: string | null;
        bidId: string;
        municipality: string | null;
        trade: string | null;
      }
    | {
        kind: "email";
        id: string;
        date: Date;
        title: string;
        subtitle: string;
        gmailId: string;
        emailId: string;
        municipality: string | null;
        trade: string | null;
      };

  const bidOpportunities: BidOpportunity[] = [
    ...recentBids.map((b): BidOpportunity => {
      const text = `${b.title} ${b.agency ?? ""} ${b.projectType ?? ""}`;
      return {
        kind: "bid",
        id: `bid-${b.id}`,
        date: b.createdAt,
        title: b.title,
        subtitle: [b.agency, b.projectType].filter(Boolean).join(" · ") || b.source,
        url: b.url,
        bidId: b.id,
        municipality: (b.agency && detectMunicipality(b.agency)) ?? detectMunicipality(text),
        trade: detectTrade(text),
      };
    }),
    ...bidInviteEmails.map((e): BidOpportunity => {
      const text = `${e.subject} ${e.summary ?? ""} ${e.from}`;
      return {
        kind: "email",
        id: `email-${e.id}`,
        date: e.receivedAt,
        title: e.subject,
        subtitle: e.summary ?? e.from,
        gmailId: e.gmailId,
        emailId: e.id,
        municipality: detectMunicipality(text),
        trade: detectTrade(text),
      };
    }),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Regosa Engineering Services, Inc.</h1>
          <p className="text-sm text-slate-500">Signed in as {session.user.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/projects" className="text-sm text-brand-600 underline">
            Projects
          </Link>
          <SignOutButton />
        </div>
      </div>

      <section className="mb-10">
        <SyncControls />
      </section>

      {pendingMeetings.length > 0 && (
        <section className="mb-10">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-amber-900">
              Pending pre-bid meetings
            </h2>
            <ul className="space-y-3">
              {pendingMeetings.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-col gap-2 rounded-md border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{m.meetingTitle ?? m.subject}</p>
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
                      className="text-sm text-brand-600 underline"
                    >
                      View email
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
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Card title="Today's plan">
          {todayTasks.length === 0 ? (
            <Empty text="No plan generated yet — click “Generate today's plan.”" />
          ) : (
            <ul className="space-y-2">
              {todayTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start gap-3 rounded-md border border-slate-200 p-3"
                >
                  <TaskCheckbox taskId={t.id} />
                  <div className="flex-1">
                    <p className="font-medium">{t.title}</p>
                    {t.description && (
                      <p className="text-sm text-slate-500">{t.description}</p>
                    )}
                    {t.email?.gmailId && (
                      <a
                        href={gmailLink(t.email.gmailId)}
                        target="_blank"
                        className="mt-1 inline-block text-sm text-brand-600 underline"
                      >
                        View email
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent emails">
          {recentEmails.length === 0 ? (
            <Empty text="No emails synced yet — click “Sync Gmail.”" />
          ) : (
            <>
              <ul className="space-y-2">
                {recentEmails.map((e) => (
                  <li key={e.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <a
                        href={gmailLink(e.gmailId)}
                        target="_blank"
                        className="font-medium hover:underline"
                      >
                        {e.subject}
                      </a>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {e.category}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">{e.summary}</p>
                    {e.actionItem && (
                      <p className="mt-1 text-sm text-brand-700">→ {e.actionItem}</p>
                    )}
                    <div>
                      <AssignProjectSelect
                        emailId={e.id}
                        currentProjectId={e.projectId}
                        projects={projects}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              {totalEmailPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  {Array.from({ length: totalEmailPages }, (_, i) => i + 1).map((p) => (
                    <Link
                      key={p}
                      href={`/?emailPage=${p}`}
                      className={`rounded-md px-3 py-1 text-sm ${
                        p === emailPage
                          ? "bg-brand-600 text-white"
                          : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {p}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>

        <Card title="Open permits">
          {openPermits.length === 0 ? (
            <Empty text="No open permits tracked yet." />
          ) : (
            <ul className="space-y-2">
              {openPermits.map((p) => (
                <li key={p.id} className="rounded-md border border-slate-200 p-3">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-slate-500">
                    {p.project?.name ?? "Unassigned project"} — {p.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Bid Opportunities">
          {bidOpportunities.length === 0 ? (
            <Empty text="No bid opportunities yet — sync Gmail or scrape a bid site." />
          ) : (
            <ul className="space-y-2">
              {bidOpportunities.map((o) => {
                const href = o.kind === "bid" ? o.url : gmailLink(o.gmailId);
                return (
                  <li key={o.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {o.municipality && (
                          <p className="text-sm font-bold text-slate-700">{o.municipality}</p>
                        )}
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            className="font-medium text-brand-600 underline hover:text-brand-700"
                          >
                            {o.title}
                          </a>
                        ) : (
                          <p className="font-medium">{o.title}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {o.kind === "bid" ? "Bid site" : "Email"}
                        </span>
                        {o.trade && (
                          <span className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                            {o.trade}
                          </span>
                        )}
                        {(!o.municipality || !o.trade) && (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                            ⚠ Check {!o.municipality && !o.trade
                              ? "municipality/trade"
                              : !o.municipality
                              ? "municipality"
                              : "trade"}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-500">{o.subtitle}</p>
                    <div className="mt-1 flex items-center gap-3">
                      {o.kind === "bid" ? (
                        <ConvertBidButton bidId={o.bidId} />
                      ) : (
                        <>
                          <ConvertEmailButton emailId={o.emailId} />
                          <AssignProjectSelect
                            emailId={o.emailId}
                            currentProjectId={null}
                            projects={projects}
                          />
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-400">{text}</p>;
}
