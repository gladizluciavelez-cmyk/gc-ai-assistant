"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewPermitWithProjectForm({
  projects,
}: {
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const projectId = form.get("projectId");
    const name = form.get("name");

    try {
      const res = await fetch("/api/permits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add permit");
      setOpen(false);
      router.refresh();
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={projects.length === 0}
        className="mb-4 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        + New permit
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <select
        name="projectId"
        required
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">Select project…</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        name="name"
        required
        placeholder="Permit name (e.g. Building permit)"
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add permit"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
