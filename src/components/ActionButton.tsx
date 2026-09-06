"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ActionButton({
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
      // A crashed server function can return an empty or non-JSON body —
      // calling res.json() directly on that throws a cryptic "Unexpected
      // end of JSON input" instead of a useful message. Read as text first.
      const rawText = await res.text();
      let data: { error?: string } = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = { error: rawText || `Request failed with status ${res.status}` };
      }
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
