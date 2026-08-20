import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { NewProjectForm } from "@/components/NewProjectForm";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, openPermits] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { permits: true, subcontractors: true },
    }),
    prisma.permit.findMany({
      where: { status: { not: "APPROVED" } },
      include: { project: true },
      take: 10,
    }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Link href="/" className="text-sm text-brand-600 underline">
          ← Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <NewProjectForm />

          {projects.length === 0 ? (
            <p className="text-sm text-slate-400">
              No projects yet — create one above, or convert a scraped bid
              into a project from the dashboard.
            </p>
          ) : (
            <ul className="space-y-3">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-600"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{p.name}</p>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {p.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {p.client ?? "No client set"} · {p.projectType ?? "unclassified"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {p.subcontractors.length} subcontractor(s) · {p.permits.length} permit(s)
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">Open permits</h2>
          {openPermits.length === 0 ? (
            <p className="text-sm text-slate-400">No open permits tracked yet.</p>
          ) : (
            <ul className="space-y-2">
              {openPermits.map((p) => (
                <li
                  key={p.id}
                  className="rounded-md border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-slate-500">
                    {p.project?.name ?? "Unassigned project"} — {p.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
