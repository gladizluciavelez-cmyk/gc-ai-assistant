"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EditProjectForm({
  projectId,
  initial,
}: {
  projectId: string;
  initial: {
    name: string;
    client: string;
    address: string;
    projectType: string;
    notes: string;
    startDate: string; // yyyy-mm-dd or ""
    targetDate: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSave() {
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      router.refresh();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-brand-600 underline"
      >
        Edit project
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
      <Field label="Name">
        <input
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </Field>
      <Field label="Client / Agency">
        <input
          value={form.client}
          onChange={(e) => update("client", e.target.value)}
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </Field>
      <Field label="Address">
        <input
          value={form.address}
          onChange={(e) => update("address", e.target.value)}
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </Field>
      <Field label="Project type / trade">
        <input
          value={form.projectType}
          onChange={(e) => update("projectType", e.target.value)}
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date">
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => update("startDate", e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </Field>
        <Field label="Target date">
          <input
            type="date"
            value={form.targetDate}
            onChange={(e) => update("targetDate", e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </Field>
      </div>
      <Field label="Notes">
        <textarea
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </Field>
      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={saving}
          className="text-sm text-slate-500 underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
