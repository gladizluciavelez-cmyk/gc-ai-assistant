// Shared presentational pieces for the redesigned UI (sidebar layout, cards,
// tags, stat tiles). Server-safe — no hooks — so pages can use them directly.

export const COMPANY_NAME = "Regosa Engineering Services, Inc.";

// Municipalities the daily bid refresh currently covers. Mirrors the SCRAPERS
// list in /api/scrape/all — keep the two in sync when adding a city.
export const COVERED_SOURCES = [
  "Miami-Dade County",
  "City of Miami",
  "Miami Beach",
  "North Miami",
  "Doral",
  "Hialeah Gardens",
  "Miami Springs",
  "Miami Shores",
  "Bay Harbor Islands",
  "Opa-locka",
  "Florida City",
  "Surfside",
  "Cutler Bay",
];

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-start gap-3 sm:justify-end">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
      {text}
    </p>
  );
}

const TAG_TONES = {
  slate: "bg-slate-100 text-slate-600",
  blue: "bg-blue-100 text-blue-800",
  violet: "bg-violet-100 text-violet-800",
  sky: "bg-sky-100 text-sky-800",
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-800",
  orange: "bg-orange-100 text-orange-800",
} as const;

export type TagTone = keyof typeof TAG_TONES;

export function Tag({ tone = "slate", children }: { tone?: TagTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${TAG_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatTile({
  label,
  value,
  note,
  dot = "bg-brand-600",
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  dot?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </div>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
      {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

// Email categories → the short labels/colors used across the dashboard.
export const EMAIL_CATEGORY: Record<string, { label: string; tone: TagTone }> = {
  BID_INVITE: { label: "Bid Invite", tone: "blue" },
  SCHEDULING: { label: "Meeting", tone: "violet" },
  PERMIT: { label: "Permit", tone: "amber" },
  SUBCONTRACTOR_UPDATE: { label: "Subcontractor", tone: "sky" },
  CLIENT: { label: "Client", tone: "green" },
  OTHER: { label: "General", tone: "slate" },
};

export const PROJECT_STATUS: Record<string, { label: string; tone: TagTone }> = {
  BIDDING: { label: "Bidding", tone: "amber" },
  AWARDED: { label: "Active", tone: "blue" },
  PRECONSTRUCTION: { label: "Active", tone: "blue" },
  IN_PROGRESS: { label: "Active", tone: "blue" },
  ON_HOLD: { label: "On Hold", tone: "slate" },
  NOT_AWARDED: { label: "Not Awarded", tone: "red" },
  COMPLETE: { label: "Complete", tone: "green" },
};

export const PERMIT_STATUS: Record<string, { label: string; tone: TagTone }> = {
  NOT_SUBMITTED: { label: "Not Submitted", tone: "slate" },
  SUBMITTED: { label: "Submitted", tone: "blue" },
  UNDER_REVIEW: { label: "Under Review", tone: "amber" },
  APPROVED: { label: "Approved", tone: "green" },
  REJECTED: { label: "Corrections Required", tone: "red" },
  EXPIRED: { label: "Expired", tone: "red" },
};

export function gmailLink(gmailId: string) {
  return `https://mail.google.com/mail/u/0/#all/${gmailId}`;
}

export function shortDate(d: Date) {
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
