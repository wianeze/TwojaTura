import type { ComponentPropsWithoutRef } from "react";

type PanelProps = ComponentPropsWithoutRef<"section">;

export function Panel({ className = "", ...props }: PanelProps) {
  return (
    <section
      className={`material-panel premium-edge bg-surface shadow-soft rounded-[1.75rem] ${className}`}
      {...props}
    />
  );
}
