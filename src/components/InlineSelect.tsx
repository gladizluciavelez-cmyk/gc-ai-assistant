"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InlineSelect({
  endpoint,
  field,
  value,
  options,
}: {
  endpoint: string;
  field: string;
  value: string;
  options: string[];
}) {
  const [current, setCurrent] = useState(value);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function onChange(newValue: string) {
    setCurrent(newValue);
    setSaving(true);
    try {
      await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newValue }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={current}
      disabled={saving}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
