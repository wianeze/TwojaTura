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
        <p className="text-xs font-bold tracking-[0.2em] text-[#e3ae67] uppercase">
          {eyebrow}
        </p>
        <h1 className="font-display text-cream mt-3 text-4xl font-semibold tracking-tight drop-shadow-[0_2px_12px_rgba(20,10,7,0.32)] sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#d8c7b5] sm:text-lg">
          {description}
        </p>
      </div>
      {/*
        Na mobile nagłówek jest kolumną, więc domyślne align-items: stretch
        rozciągałoby akcję na całą szerokość. self-end trzyma ją przy prawej
        krawędzi bez rozciągania, a od sm: wraca zachowanie z items-end.
      */}
      {action ? <div className="self-end sm:self-auto">{action}</div> : null}
    </header>
  );
}
