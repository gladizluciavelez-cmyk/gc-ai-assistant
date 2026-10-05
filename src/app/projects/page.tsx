import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org";
import { AppShell } from "@/components/AppShell";
import { SignInScreen } from "@/components/SignInScreen";
import { NewProjectForm } from "@/components/NewProjectForm";
import { NewPermitWithProjectForm } from "@/components/NewPermitWithProjectForm";
import { Card, Empty, PERMIT_STATUS, PROJECT_STATUS, PageHeader, Tag, shortDate } from "@/components/ui";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "all", label: "All" },
  { key: "Active", label: "Active" },
  { key: "Bidding", label: "Bidding" },
  { key: "Not Awarded", label: "Not Awarded" },
  { key: "Complete", label: "Complete" },
];

export default async function ProjectsPage({ searchParams }: { searchParams: { status?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return <SignInScreen />;
  const ctx = await getOrgContext();
  if (!ctx) return <SignInScreen />;
  const { orgId } = ctx;

  const [projects, openPermits] = await Promise.all([
    prisma.project.findMany({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
      include: { permits: true, subcontractors: true, _count: { select: { emails: true } } },
    }),
    prisma.permit.findMany({
      where: { project: { orgId }, status: { not: "APPROVED" } },
      include: { project: true },
      take: 10,
    }),
  ]);

  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }));
  const statusLabel = (s: string) => PROJECT_STATUS[s]?.label ?? s;
  const tab = TABS.some((t) => t.key === searchParams.status) ? searchParams.status! : "all";
  const shown = tab === "all" ? projects : projects.filter((p) => statusLabel(p.status) === tab);
  const activeCount = projects.filter((p) => statusLabel(p.status) === "Active").length;

  return (
    <AppShell user={session.user}>
      <PageHeader
        eyebrow="Active work"
        title="Projects"
        subtitle={`${activeCount} active project${activeCount === 1 ? "" : "s"} · ${openPermits.length} open permit${openPermits.length === 1 ? "" : "s"}`}
      />

      <div className="mb-8">
        <NewProjectForm />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <div className="-mt-1 mb-2 flex gap-5 overflow-x-auto border-b border-slate-200">
            {TABS.map((t) => {
              const count =
                t.key === "all" ? projects.length : projects.filter((p) => statusLabel(p.status) === t.key).length;
              const on = t.key === tab;
              return (
                <Link
                  key={t.key}
                  href={t.key === "all" ? "/projects" : `/projects?status=${encodeURIComponent(t.key)}`}
                  className={`-mb-px flex shrink-0 gap-1.5 border-b-2 pb-2.5 text-[13px] ${
                    on
                      ? "border-brand-600 font-semibold text-slate-900"
                      : "border-transparent font-medium text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t.label}
                  <span className={`text-xs font-semibold ${on ? "text-brand-600" : "text-slate-400"}`}>{count}</span>
                </Link>
              );
            })}
          </div>

          {shown.length === 0 ? (
            <Empty
              text={
                projects.length === 0
                  ? "No projects yet — create one above, or click “Placed Bid” on a bid opportunity."
                  : "No projects with this status."
              }
            />
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(0,1fr)_110px_64px_64px_80px] gap-4 border-b border-slate-200 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:grid">
                <span>Project</span>
                <span>Status</span>
                <span>Permits</span>
                <span>Emails</span>
                <span>Activity</span>
              </div>
              <ul>
                {shown.map((p) => {
                  const st = PROJECT_STATUS[p.status] ?? { label: p.status, tone: "slate" as const };
                  return (
                    <li key={p.id} className="border-b border-slate-100 last:border-0">
                      <Link
                        href={`/projects/${p.id}`}
                        className="grid grid-cols-1 gap-1.5 rounded-lg px-2 py-3 hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_110px_64px_64px_80px] md:items-center md:gap-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{p.name}</p>
                          <p className="truncate text-xs text-slate-500">
                            {[p.client, p.address ?? p.projectType].filter(Boolean).join(" · ") || "No client set"}
                          </p>
                        </div>
                        <div>
                          <Tag tone={st.tone}>{st.label}</Tag>
                        </div>
                        <span className="text-[13px] font-medium">
                          {p.permits.length}
                          <span className="text-slate-400 md:hidden"> permits</span>
                        </span>
                        <span className="text-[13px] font-medium">
                          {p._count.emails}
                          <span className="text-slate-400 md:hidden"> emails</span>
                        </span>
                        <span className="text-xs text-slate-500">{shortDate(p.updatedAt)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>

        <Card title="Open Permits" subtitle={`${openPermits.length} not yet approved`}>
          <div className="mb-4">
            <NewPermitWithProjectForm projects={projectOptions} />
          </div>
          {openPermits.length === 0 ? (
            <Empty text="No open permits tracked yet." />
          ) : (
            <ul className="space-y-2.5">
              {openPermits.map((p) => {
                const st = PERMIT_STATUS[p.status] ?? { label: p.status, tone: "slate" as const };
                return (
                  <li key={p.id} className="rounded-xl border border-slate-200 px-3.5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold">{p.name}</p>
                      <Tag tone={st.tone}>{st.label}</Tag>
                    </div>
                    {p.project ? (
                      <Link href={`/projects/${p.project.id}`} className="text-xs text-slate-500 hover:underline">
                        {p.project.name}
                      </Link>
                    ) : (
                      <p className="text-xs text-slate-400">Unassigned project</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
