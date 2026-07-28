import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InlineSelect } from "@/components/InlineSelect";
import { NewSubcontractorForm } from "@/components/NewSubcontractorForm";
import { NewPermitForm } from "@/components/NewPermitForm";

export const dynamic = "force-dynamic";

const PROJECT_STATUSES = [
  "BIDDING",
  "AWARDED",
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

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      permits: true,
      subcontractors: { include: { subcontractor: true } },
      emails: { orderBy: { receivedAt: "desc" } },
      bid: true,
    },
  });

  if (!project) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/projects" className="text-sm text-brand-600 underline">
        ← All projects
      </Link>

      <div className="mt-4 mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="text-sm text-slate-500">
            {project.client ?? "No client set"} · {project.address ?? "No address set"}
          </p>
        </div>
        <InlineSelect
          endpoint={`/api/projects/${project.id}`}
          field="status"
          value={project.status}
          options={PROJECT_STATUSES}
        />
      </div>

      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Subcontractors</h2>
        {project.subcontractors.length === 0 ? (
          <p className="mb-3 text-sm text-slate-400">None added yet.</p>
        ) : (
          <ul className="mb-3 space-y-1">
            {project.subcontractors.map((ps) => (
              <li key={ps.id} className="text-sm">
                <span className="font-medium">{ps.subcontractor.name}</span>
                {ps.subcontractor.trade && (
                  <span className="text-slate-500"> — {ps.subcontractor.trade}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <NewSubcontractorForm projectId={project.id} />
      </section>

      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Permits</h2>
        {project.permits.length === 0 ? (
          <p className="mb-3 text-sm text-slate-400">None added yet.</p>
        ) : (
          <ul className="mb-3 space-y-2">
            {project.permits.map((permit) => (
              <li key={permit.id} className="flex items-center justify-between text-sm">
                <span>{permit.name}</span>
                <InlineSelect
                  endpoint={`/api/permits/${permit.id}`}
                  field="status"
                  value={permit.status}
                  options={PERMIT_STATUSES}
                />
              </li>
            ))}
          </ul>
        )}
        <NewPermitForm projectId={project.id} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Linked emails</h2>
        {project.emails.length === 0 ? (
          <p className="text-sm text-slate-400">
            No emails assigned to this project yet — assign one from the
            dashboard.
          </p>
        ) : (
          <ul className="space-y-2">
            {project.emails.map((e) => (
              <li key={e.id} className="text-sm">
                <span className="font-medium">{e.subject}</span>
                <span className="text-slate-500"> — {e.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
