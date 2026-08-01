"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TaskCheckbox({ taskId }: { taskId: string }) {
  const [checking, setChecking] = useState(false);
  const router = useRouter();

  async function onChange() {
    setChecking(true);
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DONE" }),
      });
      router.refresh();
    } finally {
      setChecking(false);
    }
  }

  return (
    <input
      type="checkbox"
      disabled={checking}
      onChange={onChange}
      className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300"
      aria-label="Mark task complete"
    />
  );
}
