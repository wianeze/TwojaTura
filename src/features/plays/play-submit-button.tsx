"use client";

import { ActionSubmitButton } from "@/components/ui/action-submit-button";

export function PlaySubmitButton({
  label,
  pendingLabel,
  pendingOverride,
}: {
  label: string;
  pendingLabel: string;
  // Create-mode's form uses onSubmit (not a form action), so useFormStatus
  // can't see it as pending — the caller tracks that itself and passes it
  // in explicitly instead.
  pendingOverride?: boolean;
}) {
  return (
    <ActionSubmitButton
      action="chronicle"
      label={label}
      pendingLabel={pendingLabel}
      pendingOverride={pendingOverride}
    />
  );
}
