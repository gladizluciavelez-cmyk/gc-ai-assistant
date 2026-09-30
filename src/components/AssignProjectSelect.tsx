"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AssignProjectSelect({
  emailId,
  currentProjectId,
  projects,
}: {
  emailId: string;
  currentProjectId: string | null;
  projects: { id: string; name: string }[];
}) {
  const [value, setValue] = useState(currentProjectId ?? "");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function onChange(newValue: string) {
    setValue(newValue);
    setSaving(true);
    try {
      await fetch(`/api/emails/${emailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: newValue || null }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={value}
      disabled={saving}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full max-w-full rounded-md border px-2 py-1.5 text-xs font-medium ${
        value
          ? "border-blue-100 bg-brand-50 text-brand-700"
          : "border-dashed border-slate-300 bg-white text-slate-500"
      }`}
    >
      <option value="">Assign project…</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
