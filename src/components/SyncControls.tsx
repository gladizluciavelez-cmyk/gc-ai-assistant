"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function ActionButton({
  label,
  endpoint,
}: {
  label: string;
  endpoint: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function run() {
    setStatus("loading");
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setMessage("Complete!");
      setStatus("done");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={run}
        disabled={status === "loading"}
        className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {status === "loading" ? "Running…" : label}
      </button>
      {message && (
        <span className={`text-xs ${status === "error" ? "text-red-600" : "text-slate-500"}`}>
          {message}
        </span>
      )}
    </div>
  );
}

export function SyncControls() {
  return (
    <div className="flex flex-wrap gap-3">
      <ActionButton label="Sync Gmail" endpoint="/api/gmail/sync" />
      <ActionButton label="Generate today's plan" endpoint="/api/tasks/generate" />
      <ActionButton label="Scrape Miami-Dade bids" endpoint="/api/scrape/miami-dade" />
    </div>
  );
}
