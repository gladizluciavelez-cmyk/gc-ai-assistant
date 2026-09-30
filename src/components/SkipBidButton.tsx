"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SKIP_REASONS = [
  "Not our trade",
  "Too far / out of area",
  "No capacity right now",
  "Bid amount too small",
  "Missed the deadline",
  "Other",
];

export function SkipBidButton({
  sourceType,
  sourceId,
  title,
  municipality,
  trade,
}: {
  sourceType: "bid" | "email";
  sourceId: string;
  title: string;
  municipality: string | null;
  trade: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(SKIP_REASONS[0]);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function confirmSkip() {
    setSubmitting(true);
    try {
      await fetch("/api/bid-decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          sourceId,
          decision: "SKIPPED",
          reason,
          title,
          municipality,
          trade,
        }),
      });
      router.refresh();
    } finally {
      setSubmitting(false);
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex-1 rounded-lg border border-brand-600 bg-white px-4 py-2.5 text-sm font-semibold text-brand-600 hover:bg-brand-50"
      >
        Skip
      </button>
    );
  }

  return (
    <div className="flex flex-1 flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5">
      <span className="text-xs font-medium text-slate-500">Why skip?</span>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
      >
        {SKIP_REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        onClick={confirmSkip}
        disabled={submitting}
        className="text-sm text-red-600 underline disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Confirm skip"}
      </button>
      <button
        onClick={() => setOpen(false)}
        disabled={submitting}
        className="text-sm text-slate-400 underline"
      >
        Cancel
      </button>
    </div>
  );
}
