"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewSubcontractorForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    try {
      await fetch("/api/subcontractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          trade: form.get("trade") || undefined,
          email: form.get("email") || undefined,
          projectId,
        }),
      });
      router.refresh();
      (e.target as HTMLFormElement).reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
      <input
        name="name"
        required
        placeholder="Subcontractor name"
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
      />
      <input
        name="trade"
        placeholder="Trade (e.g. electrical)"
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
      />
      <input
        name="email"
        placeholder="Email (optional)"
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-brand-600 px-3 py-1 text-sm text-white disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}
