"use client";

import { useFormStatus } from "react-dom";
import { useCanWrite } from "@/features/auth/member-role-context";
import { ActionButton } from "./action-button";
import type {
  ActionEmphasis,
  ActionSize,
  ActionVariant,
} from "./action-button-styles";

export function ActionSubmitButton({
  action,
  size = "large",
  emphasis,
  label,
  pendingLabel,
  pendingOverride,
  fullWidth,
  className,
}: {
  action: ActionVariant;
  size?: ActionSize;
  emphasis?: ActionEmphasis;
  label: React.ReactNode;
  pendingLabel: string;
  // Formularz w trybie tworzenia partii używa onSubmit (a nie form action),
  // więc useFormStatus go nie widzi — wołający śledzi to sam i przekazuje
  // stan jawnie.
  pendingOverride?: boolean;
  fullWidth?: boolean;
  className?: string;
}) {
  const { pending: formPending } = useFormStatus();
  const pending = pendingOverride ?? formPending;
  const canWrite = useCanWrite();

  if (!canWrite) {
    return (
      <p className="text-muted text-xs font-semibold">
        Tryb tylko do odczytu — zapis niedostępny.
      </p>
    );
  }

  return (
    <ActionButton
      type="submit"
      action={action}
      size={size}
      emphasis={emphasis}
      fullWidth={fullWidth}
      disabled={pending}
      loading={pending}
      loadingLabel={pendingLabel}
      className={className}
    >
      {label}
    </ActionButton>
  );
}
