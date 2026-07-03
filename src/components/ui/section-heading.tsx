import type { ReactNode } from "react";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: SectionHeadingProps) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <p className="text-accent text-xs font-bold tracking-[0.2em] uppercase">
          {eyebrow}
        </p>
        <h1 className="font-display text-foreground mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="text-muted mt-4 max-w-2xl text-base leading-7 sm:text-lg">
          {description}
        </p>
      </div>
      {action}
    </header>
  );
}
