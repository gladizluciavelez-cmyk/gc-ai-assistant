"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinTeamButton({ token, orgName }: { token: string; orgName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function join() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/team/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not join");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={join}
        disabled={busy}
        className="w-full rounded-lg bg-slate-900 px-4 py-3 text-[15px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {busy ? "Joining…" : `Join ${orgName}`}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
