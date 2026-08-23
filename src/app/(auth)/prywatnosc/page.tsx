import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/ui/panel";

export const metadata: Metadata = { title: "Prywatność" };

export default function PrivacyPage() {
  return (
    <Panel className="paper-wash p-5 sm:p-8">
      <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
        Prywatna chata
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold">Prywatność</h1>
      <div className="text-muted mt-4 space-y-4 text-sm leading-6">
        <p>
          Twoja Tura zapisuje logi bezpieczeństwa oraz podstawowe statystyki
          korzystania z funkcji aplikacji. Pomaga nam to chronić konta,
          diagnozować błędy i rozwijać funkcje używane przez grupę.
        </p>
        <p>
          Rejestrujemy m.in. czas logowania, odwiedzane sekcje i użycie
          najważniejszych akcji. Nie zapisujemy treści formularzy, notatek ani
          komentarzy w statystykach. Nie korzystamy z trackerów reklamowych,
          zewnętrznej analityki, fingerprintingu, heatmap ani analitycznych
          cookies.
        </p>
        <p>
          Dostęp do szczegółowych danych ma wyłącznie administrator. Surowe
          statystyki użycia przechowujemy do 90 dni, a logi bezpieczeństwa do
          180 dni. Dłużej przechowujemy jedynie zbiorcze statystyki oraz
          historię operacji administratora.
        </p>
      </div>
      <Link
        href="/logowanie"
        className="text-accent mt-6 inline-flex text-sm font-semibold underline decoration-current/30 underline-offset-4"
      >
        Wróć do logowania
      </Link>
    </Panel>
  );
}
