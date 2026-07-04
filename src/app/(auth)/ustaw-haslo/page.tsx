import type { Metadata } from "next";
import { Panel } from "@/components/ui/panel";
import { SetPasswordForm } from "@/features/auth/set-password-form";

export const metadata: Metadata = { title: "Ustaw hasło" };

export default function SetPasswordPage() {
  return (
    <Panel className="paper-wash p-6 sm:p-8">
      <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
        Klucz do Chaty
      </p>
      <h1 className="font-display mt-3 text-3xl font-semibold">Ustaw hasło</h1>
      <p className="text-muted mt-3 text-sm leading-6">
        Wybierz nowe hasło do swojego konta. Link musi pochodzić z zaproszenia
        albo wiadomości odzyskiwania hasła.
      </p>
      <SetPasswordForm />
    </Panel>
  );
}
