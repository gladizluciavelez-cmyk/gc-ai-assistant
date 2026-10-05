"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Fields = {
  title?: string | null; // bids only
  projectNumber?: string | null; // emails only
  agency: string | null;
  municipality: string | null;
  address: string | null;
  scope: string | null;
  dueISO?: string | null; // bids only
  meetingISO: string | null;
  meetingAddress: string | null;
};

// ISO string -> value for <input type="datetime-local"> in the user's timezone.
function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const toISO = (local: string) => (local ? new Date(local).toISOString() : null);

/**
 * Inline editor for a bid opportunity. Scrapers (BidNet especially) often miss
 * the address and pre-bid meeting, so this lets the GC fill them in by hand.
 * Saving a meeting date re-arms the "Confirm & Add to Calendar" prompt.
 */
export function EditBidButton({
  kind,
  id,
  initial,
}: {
  kind: "bid" | "email";
  id: string;
  initial: Fields;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [f, setF] = useState({
    title: initial.title ?? "",
    projectNumber: initial.projectNumber ?? "",
    agency: initial.agency ?? "",
    municipality: initial.municipality ?? "",
    address: initial.address ?? "",
    scope: initial.scope ?? "",
    due: toLocalInput(initial.dueISO),
    meeting: toLocalInput(initial.meetingISO),
    meetingAddress: initial.meetingAddress ?? "",
  });
  const router = useRouter();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function save() {
    setSaving(true);
    setError("");
    try {
      const common = {
        agency: f.agency,
        municipality: f.municipality,
        address: f.address,
        scope: f.scope,
        meetingISO: toISO(f.meeting),
        meetingAddress: f.meetingAddress,
      };
      const body =
        kind === "bid"
          ? { ...common, title: f.title, dueISO: toISO(f.due) }
          : { ...common, projectNumber: f.projectNumber };
      const res = await fetch(kind === "bid" ? `/api/bids/${id}` : `/api/emails/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-slate-500 underline hover:text-slate-800"
      >
        Edit details
      </button>
    );
  }

  const field = (label: string, key: keyof typeof f, type = "text", ph = "") => (
    <label className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3 text-[13px]">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <input
        type={type}
        value={f[key]}
        onChange={set(key)}
        placeholder={ph}
        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-900"
      />
    </label>
  );

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      {kind === "bid" ? field("Title", "title") : field("Project No.", "projectNumber")}
      {field("Agency", "agency")}
      {field("Municipality", "municipality", "text", "e.g. Miami Beach")}
      {field("Address", "address")}
      {field("Scope", "scope")}
      {kind === "bid" && field("Bid Due", "due", "datetime-local")}
      {field("Pre-Bid Meeting", "meeting", "datetime-local")}
      {field("Meeting Location", "meetingAddress")}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={saving}
          className="text-sm text-slate-500 underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
