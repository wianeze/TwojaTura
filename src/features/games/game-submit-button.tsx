"use client";

import { ActionSubmitButton } from "@/components/ui/action-submit-button";
import type { ActionVariant } from "@/components/ui/action-button-styles";

export function GameSubmitButton({
  children,
  pendingLabel,
  action = "shelf",
  className = "",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  // Ten sam formularzowy przycisk obsługuje zapis gry (Półka) i zapis
  // oceny — kolor musi odpowiadać akcji, nie komponentowi.
  action?: ActionVariant;
  className?: string;
}) {
  return (
    <ActionSubmitButton
      action={action}
      label={children}
      pendingLabel={pendingLabel}
      className={className}
    />
  );
}
