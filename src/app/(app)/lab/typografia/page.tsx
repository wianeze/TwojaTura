import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardShowcase } from "@/features/dashboard/dashboard-showcase";
import { TypographyLabSwitcher } from "@/features/lab/typography-lab-switcher";

export const metadata: Metadata = { title: "Typography Lab" };

export default async function TypographyLabPage() {
  // Layout grupy (app) nadal wymaga aktywnego członkostwa. Sam lab jest
  // jednak narzędziem lokalnym, a nie panelem administratora: w development
  // może go otworzyć każdy zalogowany aktywny użytkownik. Produkcyjnie trasa
  // pozostaje zamknięta i nie jest linkowana w nawigacji.
  if (process.env.NODE_ENV === "production") {
    redirect("/");
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[0.62rem] font-bold tracking-[0.18em] text-[#e3ae67] uppercase">
          Dokumentacja · tylko development
        </p>
        <h1 className="font-display text-cream mt-2 text-[1.85rem] font-semibold tracking-tight sm:text-[2.15rem]">
          Typography Lab
        </h1>
        <p className="mt-2 max-w-3xl text-[0.85rem] text-[#d8c7b1]">
          Porównanie 5 systemów typograficznych na prawdziwej treści strony
          Stół (
          <code className="rounded bg-black/25 px-1 py-0.5 text-[0.78rem]">
            DashboardShowcase
          </code>
          , bez kopii). Przełącznik i cała warstwa czcionek żyją w{" "}
          <code className="rounded bg-black/25 px-1 py-0.5 text-[0.78rem]">
            src/features/lab/
          </code>{" "}
          i nie wpływają na produkcyjną typografię (
          <code className="rounded bg-black/25 px-1 py-0.5 text-[0.78rem]">
            --font-sans
          </code>
          /
          <code className="rounded bg-black/25 px-1 py-0.5 text-[0.78rem]">
            --font-display
          </code>{" "}
          w globals.css). Trasa nie ma odnośnika w nawigacji.
        </p>
      </header>

      <TypographyLabSwitcher>
        <DashboardShowcase />
      </TypographyLabSwitcher>
    </div>
  );
}
