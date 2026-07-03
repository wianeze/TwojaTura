import type { ComponentPropsWithoutRef } from "react";

type PanelProps = ComponentPropsWithoutRef<"section">;

export function Panel({ className = "", ...props }: PanelProps) {
  return (
    <section
      className={`border-border bg-surface shadow-soft rounded-[1.75rem] border ${className}`}
      {...props}
    />
  );
}
