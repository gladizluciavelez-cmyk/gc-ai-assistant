"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * For when the AI misread a bid opportunity (wrong title, bogus
 * municipality/trade, garbage parse, etc.) and it just needs to go away.
 * Unlike Skip, this doesn't count toward Bid Decisions win/loss analysis —
 * it's not a real bidding decision, just cleanup.
 */
export function DismissBidButton({
  sourceType,
  sourceId,
  title,
}: {
  sourceType: "bid" | "email";
  sourceId: string;
  title: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function confirmDismiss() {
    setSubmitting(true);
    try {
      await fetch("/api/bid-decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          sourceId,
          decision: "DISMISSED",
          title,
        }),
      });
      router.refresh();
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-sm text-slate-400 underline hover:text-slate-600"
      >
        Remove (AI got this wrong)
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-slate-500">Remove this from the feed?</span>
      <button
        onClick={confirmDismiss}
        disabled={submitting}
        className="text-sm font-medium text-red-600 underline disabled:opacity-50"
      >
        {submitting ? "Removing…" : "Yes, remove"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        disabled={submitting}
        className="text-sm text-slate-400 underline"
      >
        Cancel
      </button>
    </div>
  );
}
