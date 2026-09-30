"use client";

import { signIn, signOut } from "next-auth/react";

export function SignInButton() {
  return (
    <button
      onClick={() => signIn("google")}
      className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-slate-900 px-4 py-3 text-[15px] font-semibold text-white hover:bg-slate-800"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-600">
        G
      </span>
      Continue with Google
    </button>
  );
}

export function SignOutButton({
  className = "text-sm text-slate-500 underline hover:text-slate-700",
}: {
  className?: string;
}) {
  return (
    <button onClick={() => signOut()} className={className}>
      Sign out
    </button>
  );
}
