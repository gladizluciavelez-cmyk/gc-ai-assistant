import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignInButton } from "@/components/AuthButton";
import { AssignProjectSelect } from "@/components/AssignProjectSelect";
import { ConvertBidButton } from "@/components/ConvertBidButton";
import { ConvertEmailButton } from "@/components/ConvertEmailButton";
import { SkipBidButton } from "@/components/SkipBidButton";
import { detectMunicipality, detectTrade, isBidConfirmation } from "@/lib/bid-tags";

export const dynamic = "force-dynamic";

function gmailLink(gmailId: string) {
  return `https://mail.google.com/mail/u/0/#all/${gmailId}`;
}

export default async function BidOpportunitiesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
        <h1 className="text-2xl font-semibold">Bid Opportunities</h1>
        <SignInButton />
      </main>
    );
  }

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

  // Merge scraped bids (Miami-Dade, DemandStar, etc.) and bid-invite emails
  // (OpenGov and similar) into one "Bid Opportunities" feed, newest first,
  // each tagged with where it came from.
  type BidOpportunity =
    | {
        kind: "bid";
        id: string;
        date: Date;
        title: string;
        address: string | null;
        scope: string | null;
        meetingTitle: string | null;
        meetingAt: Date | null;
        meetingAddress: string | null;
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
        address: string | null;
        scope: string | null;
        meetingTitle: string | null;
        meetingAt: Date | null;
        meetingAddress: string | null;
        gmailId: string;
        emailId: string;
        municipality: string | null;
        trade: string | null;
      };

  const bidOpportunities: BidOpportunity[] = [
    ...recentBids
      .filter((b) => !decidedKeys.has(`bid-${b.id}`))
      .map((b): BidOpportunity => {
        const text = `${b.title} ${b.agency ?? ""} ${b.projectType ?? ""}`;
        return {
          kind: "bid",
          id: `bid-${b.id}`,
          date: b.createdAt,
          title: b.title,
          address: null,
          scope: b.projectType ?? null,
          meetingTitle: null,
          meetingAt: null,
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
          address: e.bidAddress ?? null,
          scope: e.bidSummary ?? null,
          meetingTitle: e.meetingTitle ?? null,
          meetingAt: e.meetingAt ?? null,
          meetingAddress: e.meetingAddress ?? null,
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
        <h1 className="text-2xl font-semibold">Bid Opportunities</h1>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-brand-600 underline">
            ← Dashboard
          </Link>
          <Link href="/projects" className="text-sm text-brand-600 underline">
            Projects
          </Link>
          <Link href="/bid-decisions" className="text-sm text-brand-600 underline">
            Bid Decisions
          </Link>
        </div>
      </div>

      {bidOpportunities.length === 0 ? (
        <p className="text-sm text-slate-400">
          No bid opportunities yet — sync Gmail or scrape a bid site.
        </p>
      ) : (
        <ul className="space-y-2">
          {bidOpportunities.map((o) => {
            const href = o.kind === "bid" ? o.url : gmailLink(o.gmailId);
            return (
              <li key={o.id} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
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

                <div className="mt-1 space-y-0.5 text-sm text-slate-500">
                  {o.address && (
                    <p>
                      <span className="font-medium text-slate-600">Address:</span> {o.address}
                    </p>
                  )}
                  {o.scope && (
                    <p>
                      <span className="font-medium text-slate-600">Scope:</span> {o.scope}
                    </p>
                  )}
                  {(o.meetingTitle || o.meetingAt || o.meetingAddress) && (
                    <p>
                      <span className="font-medium text-slate-600">Pre-Bid Meeting:</span>{" "}
                      {[
                        o.meetingTitle,
                        o.meetingAt?.toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }),
                        o.meetingAddress,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
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

                {o.kind === "email" && (
                  <div className="mt-3 w-full">
                    <p className="mb-1 text-xs font-medium text-slate-500">Relevant Project:</p>
                    <div className="w-full [&>select]:w-full">
                      <AssignProjectSelect
                        emailId={o.emailId}
                        currentProjectId={null}
                        projects={projects}
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
