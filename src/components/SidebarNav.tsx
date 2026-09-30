"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/bid-opportunities", label: "Bid Opportunities" },
  { href: "/bid-decisions", label: "Bid Decisions", badge: "NEW" },
  { href: "/projects", label: "Projects" },
  { href: "/settings", label: "Team & Settings" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-slate-800 font-semibold text-white"
                : "font-medium text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <span
              className={`hidden h-4 w-4 rounded border-[1.5px] lg:block ${
                active ? "border-blue-400" : "border-slate-500"
              }`}
            />
            <span className="whitespace-nowrap">{item.label}</span>
            {item.badge && (
              <span className="ml-auto hidden rounded-full bg-brand-700 px-1.5 py-0.5 text-[10px] font-bold text-white lg:inline">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
