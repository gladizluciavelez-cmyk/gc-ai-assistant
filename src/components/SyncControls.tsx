"use client";

import { ActionButton } from "@/components/ActionButton";

export function SyncControls() {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <ActionButton label="↻  Sync Gmail" endpoint="/api/gmail/sync" variant="secondary" />
      <ActionButton label="Generate Today's Plan" endpoint="/api/tasks/generate" />
    </div>
  );
}
