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
      className="mt-1 rounded-md border border-slate-300 px-2 py-0.5 text-xs"
    >
      <option value="">Unassigned</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
