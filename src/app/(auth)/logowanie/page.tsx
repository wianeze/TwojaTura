import type { Metadata } from "next";
import { Panel } from "@/components/ui/panel";

export const metadata: Metadata = {
  title: "Wejście do Chaty",
};

export default function LoginPage() {
  return (
    <Panel className="paper-wash p-6 sm:p-8">
      <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
        Tylko dla zaproszonych
      </p>
      <h1 className="font-display mt-3 text-3xl font-semibold">
        Wejście do Chaty
      </h1>
      <p className="text-muted mt-3 text-sm leading-6">
        Dostęp do klubu będzie możliwy wyłącznie z zaproszenia. Formularz jest
        na razie statyczną makietą.
      </p>
      <div className="mt-7 space-y-4" aria-hidden="true">
        <div className="border-border bg-background h-12 rounded-xl border" />
        <div className="border-border bg-background h-12 rounded-xl border" />
        <div className="bg-brand/45 h-12 rounded-xl" />
      </div>
    </Panel>
  );
}
