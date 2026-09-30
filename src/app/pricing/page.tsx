import Link from "next/link";

export const metadata = { title: "Pricing · GC Assistant" };

const TIERS = [
  {
    name: "Starter",
    tag: "For owner-operators",
    price: "$99–150",
    seats: "1–2 seats",
    cta: "Start a pilot",
    features: [
      "Inbox sorting & AI email summaries",
      "Today's Plan, generated daily",
      "South Florida bid feed (up to 5 municipalities)",
      "Project & permit tracking",
      "Email support",
    ],
  },
  {
    name: "Team",
    tag: "For estimating teams",
    price: "$250–350",
    seats: "Up to 6 seats",
    cta: "Start a pilot",
    popular: true,
    features: [
      "Everything in Starter",
      "Shared team inboxes & roles",
      "Bid filtering by municipality, trade & value",
      "Pre-bid meeting → Calendar automation",
      "Up to 12 municipalities",
      "Priority support",
    ],
  },
  {
    name: "Pro",
    tag: "For growing GCs",
    price: "$500–700",
    seats: "Unlimited seats",
    cta: "Talk to us",
    features: [
      "Everything in Team",
      "Bid Decisions win/loss analytics",
      "QuickBooks integration",
      "Unlimited municipalities",
      "Win-rate benchmarks vs. similar GCs (coming soon)",
      "Dedicated onboarding",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-[13px] font-bold text-white">
              GC
            </span>
            <span className="text-[17px] font-bold">GC Assistant</span>
          </Link>
          <Link
            href="/"
            className="ml-auto rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Open the app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[13px] font-bold uppercase tracking-wide text-brand-600">Pricing</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Stop missing bids. Start knowing which ones you win.
          </h1>
          <p className="mt-4 text-lg leading-7 text-slate-500">
            Every plan includes inbox sorting, a daily plan and project tracking. Grow into team
            seats, calendar automation and win/loss analytics.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 items-center gap-6 lg:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`flex flex-col gap-5 rounded-3xl p-7 ${
                t.popular
                  ? "bg-slate-900 py-10 text-white shadow-2xl shadow-blue-600/25"
                  : "border border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xl font-bold">{t.name}</p>
                {t.popular && (
                  <span className="rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-bold text-white">
                    MOST POPULAR
                  </span>
                )}
              </div>
              <p className={`-mt-3 text-sm ${t.popular ? "text-slate-400" : "text-slate-500"}`}>{t.tag}</p>
              <div>
                <p className="text-4xl font-extrabold">
                  {t.price}
                  <span className={`ml-1 text-base font-normal ${t.popular ? "text-slate-400" : "text-slate-500"}`}>
                    /mo
                  </span>
                </p>
                <p className={`mt-1 text-sm font-semibold ${t.popular ? "text-blue-300" : "text-brand-600"}`}>
                  {t.seats}
                </p>
              </div>
              <span
                className={`rounded-xl py-3 text-center text-sm font-semibold ${
                  t.popular ? "bg-brand-600 text-white" : "border border-slate-300 text-slate-900"
                }`}
              >
                {t.cta}
              </span>
              <hr className={t.popular ? "border-slate-800" : "border-slate-100"} />
              <ul className="space-y-3">
                {t.features.map((f) => {
                  const soon = f.includes("coming soon");
                  return (
                    <li key={f} className="flex gap-2.5 text-sm leading-5">
                      <span
                        className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          soon
                            ? "bg-slate-100 text-slate-400"
                            : t.popular
                            ? "bg-brand-700 text-white"
                            : "bg-blue-100 text-brand-700"
                        }`}
                      >
                        {soon ? "…" : "✓"}
                      </span>
                      <span
                        className={`${soon ? "text-slate-400" : t.popular ? "text-slate-200" : "text-slate-700"} ${
                          f.startsWith("Everything") ? "font-semibold" : ""
                        }`}
                      >
                        {f}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-xl font-bold text-amber-700">
            +
          </span>
          <div className="flex-1">
            <p className="font-semibold">One-time implementation fee</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Every municipality publishes bids differently, so we set up and test the bid feed for
              each one you want covered, connect your team&apos;s inboxes, and import your past bid
              history for Bid Decisions. Quoted at onboarding based on how many municipalities you
              need.
            </p>
          </div>
        </div>
        <p className="mt-6 text-center text-[13px] text-slate-400">
          All prices in USD, billed monthly per team. Ranges reflect pilot pricing.
        </p>
      </main>
    </div>
  );
}
