import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InlineSelect } from "@/components/InlineSelect";
import { EditProjectForm } from "@/components/EditProjectForm";
import { NewSubcontractorForm } from "@/components/NewSubcontractorForm";
import { NewPermitForm } from "@/components/NewPermitForm";

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

function gmailLink(gmailId: string) {
  return `https://mail.google.com/mail/u/0/#all/${gmailId}`;
}

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

      <div className="mt-4 mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="text-sm text-slate-500">
            {project.client ?? "No client set"} · {project.address ?? "No address set"}
            {project.projectType ? ` · ${project.projectType}` : ""}
          </p>
          {(project.startDate || project.targetDate) && (
            <p className="text-xs text-slate-400">
              {project.startDate
                ? `Start ${project.startDate.toLocaleDateString("en-US")}`
                : ""}
              {project.startDate && project.targetDate ? " · " : ""}
              {project.targetDate
                ? `Target ${project.targetDate.toLocaleDateString("en-US")}`
                : ""}
            </p>
          )}
          {project.notes && <p className="mt-1 text-sm text-slate-600">{project.notes}</p>}
        </div>
        <InlineSelect
          endpoint={`/api/projects/${project.id}`}
          field="status"
          value={project.status}
          options={PROJECT_STATUSES}
        />
      </div>

      <div className="mb-8">
        <EditProjectForm
          projectId={project.id}
          initial={{
            name: project.name,
            client: project.client ?? "",
            address: project.address ?? "",
            projectType: project.projectType ?? "",
            notes: project.notes ?? "",
            startDate: project.startDate ? project.startDate.toISOString().slice(0, 10) : "",
            targetDate: project.targetDate
              ? project.targetDate.toISOString().slice(0, 10)
              : "",
          }}
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
                <a
                  href={gmailLink(e.gmailId)}
                  target="_blank"
                  className="font-medium text-brand-600 underline hover:text-brand-700"
                >
                  {e.subject}
                </a>
                <span className="text-slate-500"> — {e.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
