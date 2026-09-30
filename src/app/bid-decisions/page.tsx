import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";
import { SignInScreen } from "@/components/SignInScreen";
import { Card, Empty, PageHeader, Tag } from "@/components/ui";
import { detectMunicipality } from "@/lib/bid-tags";

export const dynamic = "force-dynamic";

const OUTCOME = {
  PLACED: { label: "Placed Bid", tone: "blue", bar: "bg-brand-600" },
  NOT_AWARDED: { label: "Not Awarded", tone: "red", bar: "bg-red-400" },
  SKIPPED: { label: "Skipped", tone: "slate", bar: "bg-slate-400" },
} as const;

type Group = { placed: number; notAwarded: number; skipped: number };

function winRate(g: Group) {
  return g.placed === 0 ? null : Math.max(0, Math.round(((g.placed - g.notAwarded) / g.placed) * 100));
}

function groupBy(
  rows: { decision: string; municipality: string | null; trade: string | null }[],
  key: "municipality" | "trade"
) {
  const map = new Map<string, Group>();
  for (const d of rows) {
    const k = d[key] ?? (key === "trade" ? "Unknown trade" : "Unknown municipality");
    const g = map.get(k) ?? { placed: 0, notAwarded: 0, skipped: 0 };
    if (d.decision === "PLACED") g.placed++;
    else if (d.decision === "NOT_AWARDED") g.notAwarded++;
    else g.skipped++;
    map.set(k, g);
  }
  return Array.from(map.entries()).sort(
    (a, b) => b[1].placed - a[1].placed || b[1].skipped - a[1].skipped
  );
}

export default async function BidDecisionsPage({
  searchParams,
}: {
  searchParams: { municipality?: string; trade?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return <SignInScreen />;

  const allLogs = await prisma.bidDecisionLog.findMany({
    orderBy: { createdAt: "desc" },
  });

  // "Not Awarded" rows are logged from the project page and don't carry a
  // municipality, so recover it from the project's own details — otherwise
  // every loss lands in "Unknown" and per-municipality win rates are inflated.
  const lostProjectIds = allLogs
    .filter((d) => d.sourceType === "project" && !d.municipality)
    .map((d) => d.sourceId);
  const lostProjects = lostProjectIds.length
    ? await prisma.project.findMany({
        where: { id: { in: lostProjectIds } },
        select: { id: true, name: true, client: true, address: true },
      })
    : [];
  const lostMunicipality = new Map(
    lostProjects.map((p) => [
      p.id,
      detectMunicipality(`${p.client ?? ""} ${p.name} ${p.address ?? ""}`),
    ])
  );

  // DISMISSED entries are AI misreads the GC removed from the feed — not
  // real bidding decisions, so they're excluded from every stat/breakdown
  // here. The row still exists in the table so the opportunity stays hidden.
  const decisions = allLogs
    .filter((d) => d.decision !== "DISMISSED")
    .map((d) =>
      d.sourceType === "project" && !d.municipality
        ? { ...d, municipality: lostMunicipality.get(d.sourceId) ?? null }
        : d
    );

  const totals: Group = {
    placed: decisions.filter((d) => d.decision === "PLACED").length,
    notAwarded: decisions.filter((d) => d.decision === "NOT_AWARDED").length,
    skipped: decisions.filter((d) => d.decision === "SKIPPED").length,
  };
  const overall = winRate(totals);
  const byMunicipality = groupBy(decisions, "municipality");
  const byTrade = groupBy(decisions, "trade");

  const skipReasons = Array.from(
    decisions
      .filter((d) => d.decision === "SKIPPED")
      .reduce((m, d) => m.set(d.reason ?? "No reason given", (m.get(d.reason ?? "No reason given") ?? 0) + 1), new Map<string, number>())
      .entries()
  ).sort((a, b) => b[1] - a[1]);

  // Last 12 months, oldest → newest, stacked by outcome.
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en-US", { month: "short" }), counts: { PLACED: 0, NOT_AWARDED: 0, SKIPPED: 0 } };
  });
  for (const d of decisions) {
    const m = months.find((x) => x.key === `${d.createdAt.getFullYear()}-${d.createdAt.getMonth()}`);
    if (m) m.counts[d.decision as keyof typeof OUTCOME]++;
  }
  const maxMonth = Math.max(1, ...months.map((m) => m.counts.PLACED + m.counts.NOT_AWARDED + m.counts.SKIPPED));

  // Drill-down: clicking a municipality or trade filters the decision log.
  const { municipality, trade } = searchParams;
  const drill = municipality ? { key: "Municipality", value: municipality } : trade ? { key: "Trade", value: trade } : null;
  const shown = decisions.filter(
    (d) =>
      (!municipality || (d.municipality ?? "Unknown municipality") === municipality) &&
      (!trade || (d.trade ?? "Unknown trade") === trade)
  );
  const shownTotals: Group = {
    placed: shown.filter((d) => d.decision === "PLACED").length,
    notAwarded: shown.filter((d) => d.decision === "NOT_AWARDED").length,
    skipped: shown.filter((d) => d.decision === "SKIPPED").length,
  };

  return (
    <AppShell user={session.user}>
      <PageHeader
        eyebrow="Win / loss analytics"
        title="Bid Decisions"
        subtitle="Every bid you placed, skipped or lost — and what it says about where you win"
      />

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col rounded-2xl bg-gradient-to-br from-brand-700 to-slate-900 p-6 text-white">
          <p className="text-sm font-medium text-blue-200">Overall win rate</p>
          <p className="mt-2 text-6xl font-bold tracking-tight">
            {overall ?? "—"}
            {overall !== null && <span className="text-3xl text-blue-200">%</span>}
          </p>
          <p className="mt-2 text-xs text-blue-200">
            {overall === null
              ? "Place a bid to start tracking"
              : "Placed bids not marked “Not Awarded”"}
          </p>
          <div className="mt-auto flex gap-6 pt-6">
            {[
              [totals.placed, "Bids placed"],
              [totals.notAwarded, "Not awarded"],
              [totals.skipped, "Skipped"],
            ].map(([n, l]) => (
              <div key={l as string}>
                <p className="text-xl font-bold">{n}</p>
                <p className="text-xs text-blue-200">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <BreakdownCard
          title="Win rate by municipality"
          rows={byMunicipality}
          param="municipality"
          selected={municipality}
        />
        <BreakdownCard title="Win rate by trade / scope" rows={byTrade} param="trade" selected={trade} />
      </div>

      <Card
        className="mb-6"
        title="Bids over time, by outcome"
        subtitle={`${decisions.length} decisions logged · last 12 months`}
        action={
          <div className="flex flex-wrap gap-3">
            {Object.values(OUTCOME).map((o) => (
              <span key={o.label} className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <span className={`h-2.5 w-2.5 rounded-sm ${o.bar}`} />
                {o.label}
              </span>
            ))}
          </div>
        }
      >
        {decisions.length === 0 ? (
          <Empty text="No decisions logged yet — Place or Skip a bid from Bid Opportunities." />
        ) : (
          <div className="flex h-56 items-end gap-2 border-b border-slate-200 pt-2 sm:gap-4">
            {months.map((m) => {
              const total = m.counts.PLACED + m.counts.NOT_AWARDED + m.counts.SKIPPED;
              return (
                <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  {total > 0 && <span className="text-[11px] font-semibold text-slate-500">{total}</span>}
                  <div
                    className="flex w-full max-w-[40px] flex-col-reverse overflow-hidden rounded-t"
                    style={{ height: `${(total / maxMonth) * 85}%` }}
                    title={`${m.label}: ${m.counts.PLACED} placed, ${m.counts.NOT_AWARDED} not awarded, ${m.counts.SKIPPED} skipped`}
                  >
                    {(Object.keys(OUTCOME) as (keyof typeof OUTCOME)[]).map((k) =>
                      m.counts[k] ? (
                        <div
                          key={k}
                          className={`${OUTCOME[k].bar} border-t border-white`}
                          style={{ height: `${(m.counts[k] / total) * 100}%` }}
                        />
                      ) : null
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {decisions.length > 0 && (
          <div className="mt-2 flex gap-2 sm:gap-4">
            {months.map((m) => (
              <span key={m.key} className="flex-1 text-center text-[11px] text-slate-400">
                {m.label}
              </span>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card
          title={
            <>
              {drill && (
                <span className="mb-1 block text-xs font-normal text-slate-400">
                  {drill.key} ›{" "}
                  <span className="font-semibold text-brand-600">{drill.value}</span>
                </span>
              )}
              {drill ? `${drill.value} — every bid decision` : "All bid decisions"}
            </>
          }
          action={
            <div className="flex items-center gap-5 text-right">
              {[
                [shownTotals.placed, "Placed"],
                [winRate(shownTotals) === null ? "—" : `${winRate(shownTotals)}%`, "Win rate"],
                [shownTotals.skipped, "Skipped"],
              ].map(([n, l]) => (
                <div key={l as string}>
                  <p className={`text-lg font-bold ${l === "Win rate" ? "text-green-600" : ""}`}>{n}</p>
                  <p className="text-[11px] text-slate-500">{l}</p>
                </div>
              ))}
              {drill && (
                <Link href="/bid-decisions" className="text-xs font-medium text-brand-600 hover:underline">
                  Clear ✕
                </Link>
              )}
            </div>
          }
        >
          {shown.length === 0 ? (
            <Empty text="No decisions logged yet — Skip or Place a bid from Bid Opportunities." />
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(0,1fr)_90px_110px_minmax(0,180px)] gap-4 border-b border-slate-200 px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:grid">
                <span>Bid</span>
                <span>Decided</span>
                <span>Outcome</span>
                <span>Notes</span>
              </div>
              <ul>
                {shown.map((d) => {
                  const o = OUTCOME[d.decision as keyof typeof OUTCOME];
                  return (
                    <li
                      key={d.id}
                      className="grid grid-cols-1 gap-1.5 border-b border-slate-100 px-1 py-3 last:border-0 md:grid-cols-[minmax(0,1fr)_90px_110px_minmax(0,180px)] md:items-center md:gap-4"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold">{d.title}</p>
                        <p className="text-xs text-slate-500">
                          {[d.municipality, d.trade].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <span className="text-xs text-slate-600">
                        {d.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      <div>
                        <Tag tone={o.tone}>{o.label}</Tag>
                      </div>
                      <span className="text-xs text-slate-500">{d.reason ?? ""}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <Card title="Skip reasons" subtitle="Why bids were passed on">
            {skipReasons.length === 0 ? (
              <Empty text="No skips logged yet." />
            ) : (
              <ul className="space-y-2">
                {skipReasons.map(([reason, count]) => (
                  <li key={reason} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{reason}</span>
                    <span className="font-semibold">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <div className="flex gap-1.5">
              <Tag tone="violet">COMING SOON</Tag>
              <Tag>Pro</Tag>
            </div>
            <p className="font-semibold text-slate-600">Compare your win rate to similar-sized GCs</p>
            <p className="text-[13px] leading-5 text-slate-400">
              Anonymized benchmarks by municipality and trade, from GCs with a similar annual volume.
            </p>
            <div className="space-y-2.5 opacity-50">
              {[
                ["You", "w-3/5", "bg-blue-300"],
                ["Peer median", "w-2/5", "bg-slate-300"],
                ["Top quartile", "w-4/5", "bg-slate-300"],
              ].map(([l, w, c]) => (
                <div key={l}>
                  <p className="mb-1 text-xs text-slate-500">{l}</p>
                  <div className="h-2.5 rounded bg-slate-200">
                    <div className={`h-2.5 rounded ${w} ${c}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function BreakdownCard({
  title,
  rows,
  param,
  selected,
}: {
  title: string;
  rows: [string, Group][];
  param: "municipality" | "trade";
  selected?: string;
}) {
  return (
    <Card title={title} action={<span className="text-xs text-slate-400">Click to drill down</span>}>
      {rows.length === 0 ? (
        <Empty text="No decisions logged yet." />
      ) : (
        <ul className="space-y-1">
          {rows.slice(0, 6).map(([name, g]) => {
            const rate = winRate(g);
            const on = selected === name;
            return (
              <li key={name}>
                <Link
                  href={`/bid-decisions?${param}=${encodeURIComponent(name)}`}
                  className={`block rounded-lg px-2 py-1.5 ${on ? "bg-brand-50" : "hover:bg-slate-50"}`}
                >
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className={`flex-1 truncate ${on ? "font-semibold text-brand-700" : "font-medium"}`}>
                      {name}
                    </span>
                    <span className="font-bold">{rate === null ? "—" : `${rate}%`}</span>
                    <span className="w-16 text-right text-xs text-slate-400">
                      {g.placed} placed
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-slate-100">
                    <div
                      className={`h-2 rounded ${on ? "bg-brand-600" : "bg-blue-300"}`}
                      style={{ width: `${rate ?? 0}%` }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
