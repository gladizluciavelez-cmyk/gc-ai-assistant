"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConfirmMeetingButton({
  emailId,
  bidId,
  title,
  startISO,
  location,
}: {
  emailId?: string;
  bidId?: string;
  title: string;
  startISO: string;
  location?: string | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function onClick() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/calendar/create-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startISO,
          location: location ?? undefined,
          emailId,
          bidId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add to calendar");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col gap-1">
      <button
        onClick={onClick}
        disabled={submitting}
        className="whitespace-nowrap rounded-lg bg-amber-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {submitting ? "Adding…" : "Confirm & Add to Calendar"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
