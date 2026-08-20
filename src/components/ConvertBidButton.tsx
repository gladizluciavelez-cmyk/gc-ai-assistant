"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConvertBidButton({
  bidId,
  title,
  municipality,
  trade,
}: {
  bidId: string;
  title?: string;
  municipality?: string | null;
  trade?: string | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function onClick() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bids/${bidId}/convert`, { method: "POST" });
      const data = await res.json();
      if (title) {
        await fetch("/api/bid-decisions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceType: "bid",
            sourceId: bidId,
            decision: "PLACED",
            title,
            municipality,
            trade,
          }),
        });
      }
      if (res.ok && data.project?.id) {
        router.push(`/projects/${data.project.id}`);
      } else {
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={submitting}
      className="text-sm text-brand-600 underline disabled:opacity-50"
    >
      {submitting ? "Converting…" : "Convert to project"}
    </button>
  );
}
