import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org";
import { AppShell } from "@/components/AppShell";
import { SignInScreen } from "@/components/SignInScreen";
import { InviteForm, RemoveMemberButton, RevokeInviteButton } from "@/components/TeamControls";
import { COVERED_SOURCES, Card, PageHeader, Tag, shortDate } from "@/components/ui";

export const dynamic = "force-dynamic";

const AVATAR_COLORS = ["bg-brand-600", "bg-cyan-600", "bg-violet-600", "bg-orange-600", "bg-emerald-600"];

function initials(s: string) {
  const parts = s.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return <SignInScreen />;
  const ctx = await getOrgContext();
  if (!ctx) return <SignInScreen />;
  const { orgId } = ctx;

  const owner = ctx.role === "OWNER";
  const [org, invites] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
    owner
      ? prisma.invite.findMany({
          where: { orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);
  const [users, lastEmail] = await Promise.all([
    prisma.user.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
      include: { accounts: { where: { provider: "google" }, select: { refresh_token: true } } },
    }),
    prisma.emailRecord.findFirst({ where: { orgId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  const connected = (u: (typeof users)[number]) =>
    u.googleConnected && u.accounts.some((a) => a.refresh_token);
  const me = users.find((u) => u.email === session.user?.email);
  const gmailOn = me ? connected(me) : false;

  return (
    <AppShell user={session.user}>
      <PageHeader
        eyebrow={org?.name ?? "Your company"}
        title="Team & Settings"
        subtitle="Who has access, which inboxes are connected, and your plan"
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          <Card
            title="Team members"
            subtitle={`${users.length} member${users.length === 1 ? "" : "s"} · ${owner ? "invite teammates below" : "ask an owner to invite people"}`}
          >
            {owner && (
              <div className="mb-4 border-b border-slate-100 pb-4">
                <InviteForm />
                {invites.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {invites.map((i) => (
                      <li key={i.id} className="flex items-center gap-3 text-xs text-slate-600">
                        <span className="flex-1 truncate">
                          Pending: {i.email ?? "anyone with the link"} · expires {shortDate(i.expiresAt)}
                        </span>
                        <RevokeInviteButton id={i.id} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="hidden grid-cols-[minmax(0,1fr)_90px_220px] gap-4 border-b border-slate-200 px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:grid">
              <span>Member</span>
              <span>Role</span>
              <span>Gmail</span>
            </div>
            <ul>
              {users.map((u, i) => {
                const on = connected(u);
                const label = u.name ?? u.email ?? "Unknown";
                return (
                  <li
                    key={u.id}
                    className="grid grid-cols-1 gap-2 border-b border-slate-100 px-1 py-3 last:border-0 md:grid-cols-[minmax(0,1fr)_90px_220px] md:items-center md:gap-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
                          AVATAR_COLORS[i % AVATAR_COLORS.length]
                        }`}
                      >
                        {initials(label)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {label}
                          {u.email === session.user?.email && (
                            <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                    <div>
                      <Tag>{u.role === "OWNER" ? "Owner" : "Member"}</Tag>
                    </div>
                    <p className="flex items-center gap-2 text-xs">
                      <span className={`h-2 w-2 rounded-full ${on ? "bg-green-600" : "bg-amber-500"}`} />
                      <span className={on ? "text-slate-700" : "font-medium text-amber-700"}>
                        {on ? "Connected" : "Not connected — sign in again"}
                      </span>
                      {owner && u.id !== ctx.userId && (
                        <span className="ml-auto">
                          <RemoveMemberButton userId={u.id} label={label} />
                        </span>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Integrations" subtitle="Tools the assistant reads from and writes to">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Integration
                mark="M"
                color="bg-red-500"
                name="Gmail"
                desc={`Reads and sorts your inbox${lastEmail ? ` · last sync ${shortDate(lastEmail.createdAt)}` : ""}`}
                status={gmailOn ? "on" : "off"}
              />
              <Integration
                mark="31"
                color="bg-blue-600"
                name="Google Calendar"
                desc="Adds pre-bid meetings after you confirm them"
                status={gmailOn ? "on" : "off"}
              />
              <Integration
                mark="@"
                color="bg-slate-700"
                name="Email forwarding"
                desc="Forward bid emails to a private address — works with any inbox, including Outlook"
                status="soon"
              />
              <Integration
                mark="qb"
                color="bg-green-600"
                name="QuickBooks"
                desc="Sync awarded bids as estimates and jobs"
                status="soon"
              />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl bg-slate-900 p-6 text-white">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-slate-400">Current plan</p>
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold">PILOT</span>
            </div>
            <p className="mt-2 text-3xl font-bold">Free pilot</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Full access while we test with early South Florida contractors.
            </p>
            <Link
              href="/pricing"
              className="mt-5 block rounded-lg bg-white px-4 py-2.5 text-center text-[13px] font-semibold text-slate-900 hover:bg-slate-100"
            >
              See plans & pricing
            </Link>
          </div>

          <Card
            title="Municipality coverage"
            action={<span className="text-xs font-semibold text-slate-400">{COVERED_SOURCES.length}</span>}
          >
            <p className="-mt-2 mb-3 text-xs text-slate-500">Bid listings checked daily.</p>
            <ul>
              {COVERED_SOURCES.map((m) => (
                <li
                  key={m}
                  className="flex items-center gap-2 border-b border-slate-100 py-2 text-[13px] last:border-0"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                  {m}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Integration({
  mark,
  color,
  name,
  desc,
  status,
}: {
  mark: string;
  color: string;
  name: string;
  desc: string;
  status: "on" | "off" | "soon";
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-[13px] font-bold text-white ${color}`}>
          {mark}
        </span>
        <p className="flex-1 text-sm font-semibold">{name}</p>
        {status === "soon" && <Tag tone="violet">Coming soon</Tag>}
      </div>
      <p className="text-xs leading-5 text-slate-500">{desc}</p>
      {status !== "soon" && (
        <p className="mt-auto flex items-center gap-1.5 text-xs font-semibold">
          <span className={`h-2 w-2 rounded-full ${status === "on" ? "bg-green-600" : "bg-amber-500"}`} />
          <span className={status === "on" ? "text-green-800" : "text-amber-700"}>
            {status === "on" ? "Connected" : "Not connected"}
          </span>
        </p>
      )}
    </div>
  );
}
