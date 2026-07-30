"use client";

import { ActionSubmitButton } from "@/components/ui/action-submit-button";

export function MeetingSubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  return (
    <ActionSubmitButton
      action="meeting"
      label={label}
      pendingLabel={pendingLabel}
    />
  );
}
