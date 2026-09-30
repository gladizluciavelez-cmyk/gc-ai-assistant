import Link from "next/link";
import { SidebarNav } from "@/components/SidebarNav";
import { SignOutButton } from "@/components/AuthButton";
import { COMPANY_NAME } from "@/components/ui";

function initials(nameOrEmail: string) {
  const parts = nameOrEmail.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Dark left sidebar + main content column used by every signed-in page.
 * Collapses to a top bar with horizontally-scrolling nav below `lg`.
 */
export function AppShell({
  user,
  children,
}: {
  user?: { name?: string | null; email?: string | null } | null;
  children: React.ReactNode;
}) {
  const display = user?.name ?? user?.email ?? "";
  return (
    <div className="min-h-screen lg:flex">
      <aside className="flex flex-col gap-5 bg-slate-900 px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:gap-7 lg:px-5 lg:py-7">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-[13px] font-bold text-white">
            GC
          </span>
          <span className="text-base font-bold text-white">GC Assistant</span>
        </Link>

        <div className="hidden rounded-lg bg-slate-800 px-3 py-2.5 lg:block">
          <p className="text-[13px] font-semibold leading-snug text-white">{COMPANY_NAME}</p>
          <p className="mt-0.5 text-xs text-slate-400">South Florida · Pilot</p>
        </div>

        <SidebarNav />

        {user && (
          <div className="mt-auto hidden items-center gap-2.5 lg:flex">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">
              {initials(display)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">{display}</p>
              <SignOutButton className="text-xs text-slate-400 hover:text-slate-200" />
            </div>
          </div>
        )}
      </aside>

      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-10">{children}</main>
    </div>
  );
}
