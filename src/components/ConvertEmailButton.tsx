"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConvertEmailButton({
  emailId,
  title,
  municipality,
  trade,
}: {
  emailId: string;
  title: string;
  municipality: string | null;
  trade: string | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function onClick() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/emails/${emailId}/convert`, { method: "POST" });
      const data = await res.json();
      await fetch("/api/bid-decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "email",
          sourceId: emailId,
          decision: "PLACED",
          title,
          municipality,
          trade,
        }),
      });
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
      className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {submitting ? "Saving…" : "Placed Bid"}
    </button>
  );
}
