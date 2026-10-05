"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function create() {
    setBusy(true);
    setError("");
    setLink("");
    setCopied(false);
    try {
      const res = await fetch("/api/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not create invite");
      setLink(data.link);
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Teammate's Google email (optional)"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          onClick={create}
          disabled={busy}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create invite link"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {link && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-xs font-semibold text-green-900">
            Send this link. It works once and expires in 7 days.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-xs">{link}</code>
            <button onClick={copy} className="text-xs font-semibold text-green-900 underline">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RevokeInviteButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/team/invites/${id}`, { method: "DELETE" });
        router.refresh();
      }}
      className="text-xs text-red-600 underline disabled:opacity-50"
    >
      {busy ? "Revoking…" : "Revoke"}
    </button>
  );
}

export function RemoveMemberButton({ userId, label }: { userId: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Remove ${label} from this company? They lose access to company data, and their private emails and daily plan are deleted from it. Bid invites, meetings and project emails they synced stay with the company.`)) return;
        setBusy(true);
        await fetch(`/api/team/members/${userId}`, { method: "DELETE" });
        router.refresh();
      }}
      className="text-xs text-red-600 underline disabled:opacity-50"
    >
      {busy ? "Removing…" : "Remove"}
    </button>
  );
}
