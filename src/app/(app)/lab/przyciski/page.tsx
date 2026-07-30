import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { ButtonLab } from "@/features/lab/button-lab";

export const metadata: Metadata = { title: "Button Lab" };

export default async function ButtonLabPage() {
  // Trasa dokumentacyjna — ten sam wzorzec ochrony co (app)/admin/layout.tsx:
  // zwykły member i obserwator trafiają z powrotem na Stół.
  const memberState = await getCurrentMember();

  if (
    memberState.status !== "active-member" ||
    memberState.member.role !== "admin"
  ) {
    redirect("/");
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[0.62rem] font-bold tracking-[0.18em] text-[#e3ae67] uppercase">
          Dokumentacja · tylko administrator
        </p>
        <h1 className="font-display text-cream mt-2 text-[1.85rem] font-semibold tracking-tight sm:text-[2.15rem]">
          Button Lab
        </h1>
        <p className="mt-2 max-w-3xl text-[0.85rem] text-[#d8c7b1]">
          Zapis poszukiwań wyglądu przycisków akcji. Wdrożony został wariant
          B×C3 na ciemnej bazie — w aplikacji żyje jako{" "}
          <code className="rounded bg-black/25 px-1 py-0.5 text-[0.78rem]">
            ActionButton
          </code>{" "}
          i klasy{" "}
          <code className="rounded bg-black/25 px-1 py-0.5 text-[0.78rem]">
            .action-btn
          </code>{" "}
          w globals.css. Style tej strony to osobny prototyp z{" "}
          <code className="rounded bg-black/25 px-1 py-0.5 text-[0.78rem]">
            src/features/lab/
          </code>{" "}
          i nie wpływają na produkcyjne przyciski. Trasa nie ma odnośnika w
          nawigacji.
        </p>
      </header>

      <ButtonLab />
    </div>
  );
}
