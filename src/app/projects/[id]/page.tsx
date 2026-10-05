import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org";
import { AppShell } from "@/components/AppShell";
import { SignInScreen } from "@/components/SignInScreen";
import { InlineSelect } from "@/components/InlineSelect";
import { EditProjectForm } from "@/components/EditProjectForm";
import { NewSubcontractorForm } from "@/components/NewSubcontractorForm";
import { NewPermitForm } from "@/components/NewPermitForm";
import { EMAIL_CATEGORY, PROJECT_STATUS, Tag, gmailLink, shortDate } from "@/components/ui";

export const dynamic = "force-dynamic";

const PROJECT_STATUSES = [
  "BIDDING",
  "AWARDED",
  "NOT_AWARDED",
  "PRECONSTRUCTION",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETE",
];

const PERMIT_STATUSES = [
  "NOT_SUBMITTED",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
];

// Where each permit status sits on the Submitted → Under review → Approved bar.
const PERMIT_STAGE: Record<string, number> = {
  NOT_SUBMITTED: 0,
  SUBMITTED: 1,
  UNDER_REVIEW: 2,
  APPROVED: 3,
  REJECTED: 2,
  EXPIRED: 0,
};

const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return <SignInScreen />;
  const ctx = await getOrgContext();
  if (!ctx) return <SignInScreen />;
  const { orgId } = ctx;

  const project = await prisma.project.findFirst({
    where: { id: params.id, orgId },
    include: {
      permits: true,
      subcontractors: { include: { subcontractor: true } },
      emails: { orderBy: { receivedAt: "desc" } },
      bid: true,
    },
  });

  if (!project) notFound();

  const decisions = await prisma.bidDecisionLog.findMany({
    where: {
      orgId,
      OR: [
        { sourceType: "project", sourceId: project.id },
        ...(project.bid ? [{ sourceType: "bid", sourceId: project.bid.id }] : []),
        ...(project.emails.length
          ? [{ sourceType: "email", sourceId: { in: project.emails.map((e) => e.id) } }]
          : []),
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  // Bid history timeline, oldest first, stitched together from the source
  // bid listing, any pre-bid meeting, and logged decisions.
  const timeline: { at: Date; title: string; detail: string; dot: string }[] = [];
  if (project.bid) {
    timeline.push({
      at: project.bid.createdAt,
      title: "Found in South Florida bid listings",
      detail: [project.bid.agency, project.bid.externalId].filter(Boolean).join(" · "),
      dot: "bg-slate-400",
    });
    if (project.bid.preBidMeetingAt)
      timeline.push({
        at: project.bid.preBidMeetingAt,
        title: "Pre-bid meeting",
        detail: project.bid.addedToCalendar ? "Added to calendar" : "Not on calendar",
        dot: "bg-violet-600",
      });
  }
  const bidEmails = project.emails.filter((e) => e.category === "BID_INVITE");
  const firstBidEmail = bidEmails[bidEmails.length - 1]; // emails are newest-first
  if (!project.bid && firstBidEmail)
    timeline.push({
      at: firstBidEmail.receivedAt,
      title: "Bid invite received by email",
      detail: firstBidEmail.subject,
      dot: "bg-slate-400",
    });
  for (const d of decisions) {
    timeline.push({
      at: d.createdAt,
      title: d.decision === "PLACED" ? "Bid placed" : d.decision === "NOT_AWARDED" ? "Not awarded" : d.decision === "SKIPPED" ? "Skipped" : "Removed from feed",
      detail: d.reason ?? "Logged in Bid Decisions",
      dot: d.decision === "PLACED" ? "bg-brand-600" : d.decision === "NOT_AWARDED" ? "bg-red-400" : "bg-slate-300",
    });
  }
  if (["AWARDED", "PRECONSTRUCTION", "IN_PROGRESS", "COMPLETE"].includes(project.status))
    timeline.push({ at: project.updatedAt, title: "Awarded", detail: "Project is active", dot: "bg-green-600" });
  timeline.sort((a, b) => a.at.getTime() - b.at.getTime());

  const st = PROJECT_STATUS[project.status] ?? { label: project.status, tone: "slate" as const };

  return (
    <AppShell user={session.user}>
      <Link href="/projects" className="text-sm font-medium text-brand-600 hover:underline">
        ← All projects
      </Link>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <Tag tone={st.tone}>{st.label}</Tag>
            </div>
            <p className="mt-1 text-[13px] text-slate-500">
              {[
                project.client ?? "No client set",
                project.address ?? "No address set",
                project.projectType,
                project.startDate && `Started ${project.startDate.toLocaleDateString("en-US")}`,
                project.targetDate && `Target ${project.targetDate.toLocaleDateString("en-US")}`,
              ]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
            {project.notes && <p className="mt-2 text-sm text-slate-600">{project.notes}</p>}
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-slate-500">
            Status
            <InlineSelect
              endpoint={`/api/projects/${project.id}`}
              field="status"
              value={project.status}
              options={PROJECT_STATUSES}
            />
          </label>
        </div>

        <div className="mt-3">
          <EditProjectForm
            projectId={project.id}
            initial={{
              name: project.name,
              client: project.client ?? "",
              address: project.address ?? "",
              projectType: project.projectType ?? "",
              notes: project.notes ?? "",
              startDate: project.startDate ? project.startDate.toISOString().slice(0, 10) : "",
              targetDate: project.targetDate ? project.targetDate.toISOString().slice(0, 10) : "",
            }}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Column title="Linked emails" count={project.emails.length}>
            {project.emails.length === 0 ? (
              <p className="text-[13px] text-slate-400">
                No emails assigned yet — assign one from the dashboard.
              </p>
            ) : (
              <ul className="space-y-2">
                {project.emails.slice(0, 8).map((e) => {
                  const cat = EMAIL_CATEGORY[e.category] ?? EMAIL_CATEGORY.OTHER;
                  return (
                    <li key={e.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Tag tone={cat.tone}>{cat.label}</Tag>
                        <span className="ml-auto text-[11px] text-slate-400">{shortDate(e.receivedAt)}</span>
                      </div>
                      <a
                        href={gmailLink(e.gmailId)}
                        target="_blank"
                        className="mt-1 block text-[13px] font-medium hover:underline"
                      >
                        {e.subject}
                      </a>
                      {e.summary && <p className="text-xs text-slate-500">{e.summary}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Column>

          <Column title="Bid history" count={timeline.length}>
            {timeline.length === 0 ? (
              <p className="text-[13px] text-slate-400">No bid activity linked to this project.</p>
            ) : (
              <ol>
                {timeline.map((t, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`mt-1 h-3 w-3 rounded-full ring-2 ring-white ${t.dot}`} />
                      {i < timeline.length - 1 && <span className="w-0.5 flex-1 bg-slate-200" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-[13px] font-semibold">{t.title}</p>
                      <p className="text-xs text-slate-500">
                        {fmtDay(t.at)}
                        {t.detail ? ` · ${t.detail}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Column>

          <Column title="Permit status" count={project.permits.length}>
            {project.permits.length > 0 && (
              <ul className="mb-3 space-y-2.5">
                {project.permits.map((permit) => {
                  const stage = PERMIT_STAGE[permit.status] ?? 0;
                  const rejected = permit.status === "REJECTED";
                  return (
                    <li key={permit.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-semibold">{permit.name}</p>
                        <InlineSelect
                          endpoint={`/api/permits/${permit.id}`}
                          field="status"
                          value={permit.status}
                          options={PERMIT_STATUSES}
                        />
                      </div>
                      <div className="mt-2.5 grid grid-cols-3 gap-1">
                        {["Submitted", "Under review", "Approved"].map((label, i) => (
                          <div key={label}>
                            <div
                              className={`h-1.5 rounded ${
                                i < stage
                                  ? rejected
                                    ? "bg-red-400"
                                    : stage === 3
                                    ? "bg-green-500"
                                    : "bg-amber-400"
                                  : "bg-slate-200"
                              }`}
                            />
                            <p className={`mt-1 text-[11px] ${i < stage ? "text-slate-700" : "text-slate-400"}`}>
                              {label}
                            </p>
                          </div>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <NewPermitForm projectId={project.id} />
          </Column>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-base font-semibold">Subcontractors</h2>
        {project.subcontractors.length === 0 ? (
          <p className="mb-3 text-sm text-slate-400">None added yet.</p>
        ) : (
          <ul className="mb-4 flex flex-wrap gap-2">
            {project.subcontractors.map((ps) => (
              <li key={ps.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
                <span className="font-medium">{ps.subcontractor.name}</span>
                {ps.subcontractor.trade && <span className="text-slate-500"> · {ps.subcontractor.trade}</span>}
              </li>
            ))}
          </ul>
        )}
        <NewSubcontractorForm projectId={project.id} />
      </section>
    </AppShell>
  );
}

function Column({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs font-semibold text-slate-400">{count}</span>
      </div>
      {children}
    </div>
  );
}
