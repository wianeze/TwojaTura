import type { Metadata } from "next";
import { Panel } from "@/components/ui/panel";
import { signOutAction } from "@/features/auth/actions";

export const metadata: Metadata = { title: "Brak dostępu do Chaty" };

export default function AccessDeniedPage() {
  return (
    <Panel className="paper-wash p-6 text-center sm:p-8">
      <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
        Zamknięty klub
      </p>
      <h1 className="font-display mt-3 text-3xl font-semibold">
        Brak dostępu do Chaty
      </h1>
      <p className="text-muted mx-auto mt-3 max-w-sm text-sm leading-6">
        To konto nie jest aktywnym członkiem grupy. Skontaktuj się z
        administratorem, jeśli dostęp powinien być aktywny.
      </p>
      <form action={signOutAction} className="mt-7">
        <button
          type="submit"
          className="bg-brand hover:bg-brand-strong focus-visible:outline-gold rounded-xl px-5 py-3 font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Wyloguj się
        </button>
      </form>
    </Panel>
  );
}
