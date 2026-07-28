import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignInButton, SignOutButton } from "@/components/AuthButton";
import { SyncControls } from "@/components/SyncControls";
import { AssignProjectSelect } from "@/components/AssignProjectSelect";
import { ConvertBidButton } from "@/components/ConvertBidButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
        <h1 className="text-2xl font-semibold">GC Assistant</h1>
        <p className="text-slate-600">
          Connect your Google account to let the assistant read your inbox for
          project/subcontractor/permit updates and create calendar events for
          pre-bid meetings.
        </p>
        <SignInButton />
      </main>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  const [todayTasks, recentEmails, openPermits, recentBids, projects] = await Promise.all([
    prisma.taskItem.findMany({
      where: { planDate: today, status: "TODO" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.emailRecord.findMany({
      orderBy: { receivedAt: "desc" },
      take: 10,
    }),
    prisma.permit.findMany({
      where: { status: { not: "APPROVED" } },
      include: { project: true },
      take: 10,
    }),
    prisma.bid.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      where: { project: null },
    }),
    prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">GC Assistant</h1>
          <p className="text-sm text-slate-500">Signed in as {session.user.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/projects" className="text-sm text-brand-600 underline">
            Projects
          </Link>
          <SignOutButton />
        </div>
      </div>

      <section className="mb-10">
        <SyncControls />
      </section>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Card title="Today's plan">
          {todayTasks.length === 0 ? (
            <Empty text="No plan generated yet — click “Generate today's plan.”" />
          ) : (
            <ul className="space-y-2">
              {todayTasks.map((t) => (
                <li key={t.id} className="rounded-md border border-slate-200 p-3">
                  <p className="font-medium">{t.title}</p>
                  {t.description && (
                    <p className="text-sm text-slate-500">{t.description}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent emails">
          {recentEmails.length === 0 ? (
            <Empty text="No emails synced yet — click “Sync Gmail.”" />
          ) : (
            <ul className="space-y-2">
              {recentEmails.map((e) => (
                <li key={e.id} className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{e.subject}</p>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {e.category}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">{e.summary}</p>
                  {e.actionItem && (
                    <p className="mt-1 text-sm text-brand-700">→ {e.actionItem}</p>
                  )}
                  <div>
                    <AssignProjectSelect
                      emailId={e.id}
                      currentProjectId={e.projectId}
                      projects={projects}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Open permits">
          {openPermits.length === 0 ? (
            <Empty text="No open permits tracked yet." />
          ) : (
            <ul className="space-y-2">
              {openPermits.map((p) => (
                <li key={p.id} className="rounded-md border border-slate-200 p-3">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-slate-500">
                    {p.project?.name ?? "Unassigned project"} — {p.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent bids">
          {recentBids.length === 0 ? (
            <Empty text="No bids scraped yet — click “Scrape Miami-Dade bids.”" />
          ) : (
            <ul className="space-y-2">
              {recentBids.map((b) => (
                <li key={b.id} className="rounded-md border border-slate-200 p-3">
                  <p className="font-medium">{b.title}</p>
                  <p className="text-sm text-slate-500">
                    {b.agency} · {b.projectType}
                  </p>
                  <div className="mt-1 flex items-center gap-3">
                    {b.url && (
                      <a
                        href={b.url}
                        target="_blank"
                        className="text-sm text-brand-600 underline"
                      >
                        View listing
                      </a>
                    )}
                    <ConvertBidButton bidId={b.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
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
