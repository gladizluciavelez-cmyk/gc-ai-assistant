import { SignInButton } from "@/components/AuthButton";

const FEATURES = [
  ["Inbox triage", "Emails sorted into bids, meetings, permits and subs"],
  ["Pre-bid meetings", "Mandatory meetings flagged before you miss them"],
  ["Today's plan", "A short to-do list built from what came in"],
];

export function SignInScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5 sm:p-10">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-base font-bold text-white">
            GC
          </span>
          <div>
            <p className="text-xl font-bold">GC Assistant</p>
            <p className="text-xs text-slate-500">Bid tracking for contractors</p>
          </div>
        </div>

        <h1 className="mt-6 text-xl font-semibold leading-7">
          Your inbox, bids, and permits — sorted every morning.
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Connect Google so the assistant can sort project, subcontractor and permit email and put
          pre-bid meetings on your calendar.
        </p>

        <ul className="mt-6 space-y-3">
          {FEATURES.map(([title, desc]) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
                ✓
              </span>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-[13px] text-slate-500">{desc}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-7">
          <SignInButton />
        </div>
        <p className="mt-4 text-center text-xs leading-5 text-slate-400">
          Reads Gmail and adds Calendar events you confirm. You can disconnect anytime.
        </p>
      </div>
    </main>
  );
}
