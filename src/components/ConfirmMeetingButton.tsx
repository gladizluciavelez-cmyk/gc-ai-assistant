"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConfirmMeetingButton({
  emailId,
  title,
  startISO,
  location,
}: {
  emailId: string;
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
    <div className="flex flex-col gap-1">
      <button
        onClick={onClick}
        disabled={submitting}
        className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {submitting ? "Adding…" : "Confirm & add to Calendar"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
