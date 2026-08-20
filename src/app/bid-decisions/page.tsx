import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignInButton } from "@/components/AuthButton";

export const dynamic = "force-dynamic";

export default async function BidDecisionsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
        <h1 className="text-2xl font-semibold">Bid Decisions</h1>
        <SignInButton />
      </main>
    );
  }

  const decisions = await prisma.bidDecisionLog.findMany({
    orderBy: { createdAt: "desc" },
  });

  const placed = decisions.filter((d) => d.decision === "PLACED");
  const skipped = decisions.filter((d) => d.decision === "SKIPPED");

  const reasonCounts = new Map<string, number>();
  for (const d of skipped) {
    const key = d.reason ?? "No reason given";
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
  }
  const reasonBreakdown = Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1]);

  const tradeCounts = new Map<string, { placed: number; skipped: number }>();
  for (const d of decisions) {
    const key = d.trade ?? "Unknown trade";
    const entry = tradeCounts.get(key) ?? { placed: 0, skipped: 0 };
    if (d.decision === "PLACED") entry.placed++;
    else entry.skipped++;
    tradeCounts.set(key, entry);
  }
  const tradeBreakdown = Array.from(tradeCounts.entries()).sort(
    (a, b) => b[1].placed + b[1].skipped - (a[1].placed + a[1].skipped)
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bid Decisions</h1>
          <p className="text-sm text-slate-500">
            Every &quot;Placed Bid&quot; / &quot;Skip&quot; decision made from Bid Opportunities.
          </p>
        </div>
        <Link href="/" className="text-sm text-brand-600 underline">
          ← Dashboard
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Placed" value={placed.length} />
        <StatCard label="Skipped" value={skipped.length} />
        <StatCard
          label="Placed rate"
          value={
            decisions.length === 0
              ? "—"
              : `${Math.round((placed.length / decisions.length) * 100)}%`
          }
        />
        <StatCard label="Total decisions" value={decisions.length} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        <Card title="Skip reasons">
          {reasonBreakdown.length === 0 ? (
            <Empty text="No skips logged yet." />
          ) : (
            <ul className="space-y-2">
              {reasonBreakdown.map(([reason, count]) => (
                <li
                  key={reason}
                  className="flex items-center justify-between rounded-md border border-slate-200 p-2 text-sm"
                >
                  <span>{reason}</span>
                  <span className="font-semibold text-slate-700">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="By trade">
          {tradeBreakdown.length === 0 ? (
            <Empty text="No decisions logged yet." />
          ) : (
            <ul className="space-y-2">
              {tradeBreakdown.map(([trade, counts]) => (
                <li
                  key={trade}
                  className="flex items-center justify-between rounded-md border border-slate-200 p-2 text-sm"
                >
                  <span>{trade}</span>
                  <span className="text-slate-600">
                    {counts.placed} placed · {counts.skipped} skipped
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="All decisions">
        {decisions.length === 0 ? (
          <Empty text="No decisions logged yet — Skip or Place a bid from the dashboard." />
        ) : (
          <ul className="space-y-2">
            {decisions.map((d) => (
              <li key={d.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {d.municipality && (
                      <p className="text-sm font-bold text-slate-700">{d.municipality}</p>
                    )}
                    <p className="font-medium">{d.title}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs ${
                      d.decision === "PLACED"
                        ? "bg-green-100 text-green-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {d.decision === "PLACED" ? "Placed Bid" : "Skipped"}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {[d.trade, d.reason].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {d.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
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
