import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";
import { SignInScreen } from "@/components/SignInScreen";
import { ActionButton } from "@/components/ActionButton";
import { AssignProjectSelect } from "@/components/AssignProjectSelect";
import { ConvertBidButton } from "@/components/ConvertBidButton";
import { ConvertEmailButton } from "@/components/ConvertEmailButton";
import { ConfirmMeetingButton } from "@/components/ConfirmMeetingButton";
import { SkipBidButton } from "@/components/SkipBidButton";
import { DismissBidButton } from "@/components/DismissBidButton";
import { COVERED_SOURCES, Empty, PageHeader, Tag, gmailLink, shortDate } from "@/components/ui";
import { detectMunicipality, detectTrade, isBidConfirmation } from "@/lib/bid-tags";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function BidOpportunitiesPage({
  searchParams,
}: {
  searchParams: { municipality?: string; trade?: string; source?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return <SignInScreen />;

  const [recentBids, bidInviteEmails, projects, recentDecisions] = await Promise.all([
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
    // Any Skip/Placed decision already made — used to drop that opportunity
    // out of the feed below rather than leaving it dangling after a decision.
    prisma.bidDecisionLog.findMany({ select: { sourceType: true, sourceId: true } }),
  ]);

  const decidedKeys = new Set(recentDecisions.map((d) => `${d.sourceType}-${d.sourceId}`));

  // Merge public bid listings and bid-invite emails (OpenGov and similar)
  // into one feed, newest first, each tagged with where it came from.
  type BidOpportunity = {
    id: string;
    date: Date;
    title: string;
    agency: string | null;
    address: string | null;
    scope: string | null;
    dueAt: Date | null;
    meetingTitle: string | null;
    meetingAt: Date | null;
    meetingAddress: string | null;
    municipality: string | null;
    trade: string | null;
  } & (
    | { kind: "bid"; url: string | null; bidId: string }
    | { kind: "email"; gmailId: string; emailId: string; addedToCalendar: boolean }
  );

  const allOpportunities: BidOpportunity[] = [
    ...recentBids
      .filter((b) => !decidedKeys.has(`bid-${b.id}`))
      .map((b): BidOpportunity => {
        const text = `${b.title} ${b.agency ?? ""} ${b.projectType ?? ""}`;
        return {
          kind: "bid",
          id: `bid-${b.id}`,
          date: b.createdAt,
          title: b.title,
          agency: [b.agency, b.externalId].filter(Boolean).join(" · ") || null,
          address: null,
          scope: b.projectType ?? null,
          dueAt: b.openingDate,
          meetingTitle: null,
          meetingAt: b.preBidMeetingAt,
          meetingAddress: null,
          url: b.url,
          bidId: b.id,
          municipality: (b.agency && detectMunicipality(b.agency)) ?? detectMunicipality(text),
          trade: detectTrade(text),
        };
      }),
    ...bidInviteEmails
      .filter((e) => !isBidConfirmation(`${e.subject} ${e.summary ?? ""}`))
      .filter((e) => !decidedKeys.has(`email-${e.id}`))
      .map((e): BidOpportunity => {
        const text = `${e.subject} ${e.summary ?? ""} ${e.from}`;
        // Prefer the structured parse (project #, short agency name, 1-3
        // word summary) over the raw subject line — agencies format their
        // subjects too inconsistently to rely on the raw text as a title.
        const titleParts = [
          e.bidProjectNumber ? `Project No. ${e.bidProjectNumber}` : null,
          e.bidAgencyShort,
          e.bidSummary,
        ].filter(Boolean);
        const title = titleParts.length > 0 ? titleParts.join(", ") : e.subject;
        return {
          kind: "email",
          id: `email-${e.id}`,
          date: e.receivedAt,
          title,
          agency: e.bidAgencyShort ?? null,
          address: e.bidAddress ?? null,
          scope: e.bidSummary ?? null,
          dueAt: null,
          meetingTitle: e.meetingTitle ?? null,
          meetingAt: e.meetingAt ?? null,
          meetingAddress: e.meetingAddress ?? null,
          gmailId: e.gmailId,
          emailId: e.id,
          addedToCalendar: e.addedToCalendar,
          municipality: detectMunicipality(text),
          trade: detectTrade(text),
        };
      }),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  // Filter options come from what's actually in the feed.
  const municipalities = Array.from(
    new Set(allOpportunities.map((o) => o.municipality).filter(Boolean) as string[])
  ).sort();
  const trades = Array.from(
    new Set(allOpportunities.map((o) => o.trade).filter(Boolean) as string[])
  ).sort();

  const { municipality = "", trade = "", source = "" } = searchParams;
  const bidOpportunities = allOpportunities.filter(
    (o) =>
      (!municipality || o.municipality === municipality) &&
      (!trade || o.trade === trade) &&
      (!source || o.kind === source)
  );
  const filtered = Boolean(municipality || trade || source);
  const lastUpdated = recentBids[0]?.createdAt;

  return (
    <AppShell user={session.user}>
      <PageHeader
        eyebrow="Public listings + your inbox"
        title="Bid Opportunities"
        subtitle={`${allOpportunities.length} open bid${
          allOpportunities.length === 1 ? "" : "s"
        } from South Florida municipalities and bid-invite emails, in one feed`}
        actions={
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <ActionButton label="↻  Refresh bids" endpoint="/api/scrape/all" />
            {lastUpdated && (
              <span className="text-xs text-slate-500">Last updated {shortDate(lastUpdated)}</span>
            )}
          </div>
        }
      />

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">South Florida Bids</h2>
        <p className="mb-3 text-sm text-slate-500">
          Checked daily from these public bid sources, plus bid invites in your inbox.
        </p>
        <div className="flex flex-wrap gap-2">
          {COVERED_SOURCES.map((s) => (
            <span
              key={s}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600"
            >
              {s}
            </span>
          ))}
          <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-800">
            Your inbox
          </span>
        </div>
      </section>

      <form
        method="get"
        className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3"
      >
        <FilterSelect name="municipality" label="Municipality" value={municipality}>
          {municipalities.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </FilterSelect>
        <FilterSelect name="trade" label="Trade / Scope" value={trade}>
          {trades.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </FilterSelect>
        <FilterSelect name="source" label="Source" value={source}>
          <option value="bid">Public listing</option>
          <option value="email">From email</option>
        </FilterSelect>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Apply
        </button>
        {filtered && (
          <Link href="/bid-opportunities" className="px-2 text-sm text-slate-500 hover:underline">
            Clear filters
          </Link>
        )}
        <span className="ml-auto text-xs text-slate-500">
          Showing {bidOpportunities.length} of {allOpportunities.length}
        </span>
      </form>

      {bidOpportunities.length === 0 ? (
        <Empty
          text={
            filtered
              ? "No bids match these filters."
              : "No bid opportunities yet — sync Gmail or refresh bids."
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {bidOpportunities.map((o) => {
            const href = o.kind === "bid" ? o.url : gmailLink(o.gmailId);
            const meeting = [
              o.meetingTitle,
              o.meetingAt && fmt(o.meetingAt),
              o.meetingAddress,
            ]
              .filter(Boolean)
              .join(" · ");
            const canConfirmMeeting =
              o.kind === "email" && o.meetingAt && !o.addedToCalendar && o.meetingAt > new Date();
            const details: [string, string | null][] = [
              ["Municipality", o.municipality],
              ["Address", o.address],
              ["Scope", o.scope],
              ["Pre-Bid Meeting", meeting || null],
              ["Bid Due", o.dueAt ? fmt(o.dueAt) : null],
            ];
            return (
              <li
                key={o.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  {o.kind === "bid" ? (
                    <Tag tone="sky">Public listing</Tag>
                  ) : (
                    <Tag tone="violet">From email</Tag>
                  )}
                  {o.trade && <Tag>{o.trade}</Tag>}
                  <span className="ml-auto text-xs text-slate-400">{shortDate(o.date)}</span>
                </div>

                <div>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      className="text-[17px] font-semibold leading-6 text-slate-900 hover:text-brand-700 hover:underline"
                    >
                      {o.title}
                    </a>
                  ) : (
                    <p className="text-[17px] font-semibold leading-6">{o.title}</p>
                  )}
                  {o.agency && <p className="mt-0.5 text-[13px] text-slate-500">{o.agency}</p>}
                </div>

                <dl className="space-y-2 rounded-xl bg-slate-50 px-4 py-3 text-[13px]">
                  {details.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
                      <dt className="text-xs font-semibold text-slate-500">{k}</dt>
                      <dd className={v ? "text-slate-900" : "text-slate-400"}>
                        {v ?? (k === "Municipality" ? "⚠ Check municipality" : "—")}
                      </dd>
                    </div>
                  ))}
                </dl>

                {canConfirmMeeting && o.kind === "email" && (
                  <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <p className="text-[13px] font-semibold text-amber-900">
                        Pre-bid meeting detected
                      </p>
                      <p className="text-xs text-amber-700">
                        Date, time and location found in the email text
                      </p>
                    </div>
                    <ConfirmMeetingButton
                      emailId={o.emailId}
                      title={o.meetingTitle ?? o.title}
                      startISO={o.meetingAt!.toISOString()}
                      location={o.meetingAddress}
                    />
                  </div>
                )}

                {o.kind === "email" && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-slate-600">Relevant Project:</p>
                    <AssignProjectSelect
                      emailId={o.emailId}
                      currentProjectId={null}
                      projects={projects}
                    />
                  </div>
                )}

                <div className="mt-auto flex flex-col gap-2">
                  <div className="flex gap-2.5">
                    {o.kind === "bid" ? (
                      <ConvertBidButton
                        bidId={o.bidId}
                        title={o.title}
                        municipality={o.municipality}
                        trade={o.trade}
                      />
                    ) : (
                      <ConvertEmailButton
                        emailId={o.emailId}
                        title={o.title}
                        municipality={o.municipality}
                        trade={o.trade}
                      />
                    )}
                    <SkipBidButton
                      sourceType={o.kind}
                      sourceId={o.kind === "bid" ? o.bidId : o.emailId}
                      title={o.title}
                      municipality={o.municipality}
                      trade={o.trade}
                    />
                  </div>
                  <div className="text-right">
                    <DismissBidButton
                      sourceType={o.kind}
                      sourceId={o.kind === "bid" ? o.bidId : o.emailId}
                      title={o.title}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}

function FilterSelect({
  name,
  label,
  value,
  children,
}: {
  name: string;
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
      <span className="text-slate-500">{label}:</span>
      <select name={name} defaultValue={value} className="bg-transparent font-semibold outline-none">
        <option value="">All</option>
        {children}
      </select>
    </label>
  );
}
