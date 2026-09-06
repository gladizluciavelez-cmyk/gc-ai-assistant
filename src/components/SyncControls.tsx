"use client";

import { ActionButton } from "@/components/ActionButton";

export function SyncControls() {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton label="Sync Gmail" endpoint="/api/gmail/sync" />
      <ActionButton label="Generate today's plan" endpoint="/api/tasks/generate" />
    </div>
  );
}
