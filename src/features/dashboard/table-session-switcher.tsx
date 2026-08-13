import { ActionLink } from "@/components/ui/action-button";
import type { TableSessionOption } from "./types";

/*
 * Przełącznik równoległych wieczorów. Pokazuje się WYŁĄCZNIE wtedy, gdy widz
 * należy do więcej niż jednego spotkania mogącego teraz zająć sekcję — czyli
 * praktycznie nigdy, ale gdy już się zdarzy, żadna z jego grup nie może
 * zniknąć z ekranu tylko dlatego, że druga kończy się wcześniej.
 *
 * Wybór jedzie w adresie (`/?meeting=<id>`), nie w stanie komponentu ani w
 * bazie: przeżywa odświeżenie, da się go podesłać linkiem, a serwer i tak
 * waliduje go przez listę spotkań widza (patrz getTableSession) — sam
 * parametr nigdy nie jest źródłem uprawnień. Logika przełączania (href,
 * isSelected, isLive) jest tu niedotknięta — zmienia się wyłącznie warstwa
 * wizualna: nagłówek na samej górze, wyśrodkowany i większy (z mniejszym,
 * delikatniejszym dopiskiem "(przełącz)"), pod nim duże przyciski
 * (ActionButton, wariant "session" — plakietka white-button-new) OBOK
 * SIEBIE w jednym rzędzie (grid-cols-2, nie jeden pod drugim) — również na
 * 375-430px, z dozwolonym zawinięciem długiej nazwy do dwóch linii zamiast
 * zmniejszania fontu. Tekst przycisku to WYŁĄCZNIE nazwa spotkania; sygnał
 * "trwa partia" (isLive) jest ikoną płomienia zamiast dawnego
 * emoji-prefiksu przy tytule gry.
 */
export function TableSessionSwitcher({
  options,
}: {
  options: TableSessionOption[];
}) {
  if (options.length < 2) return null;

  return (
    <div className="mb-3 space-y-2.5">
      <p className="text-center text-[0.92rem] font-bold tracking-[0.08em] text-[#f0dcb8] uppercase">
        Trwają {options.length} spotkania{" "}
        <span className="text-[0.7rem] font-semibold tracking-[0.05em] text-[#c9a463]">
          (przełącz)
        </span>
      </p>

      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <ActionLink
            key={option.meetingId}
            href={option.href}
            action="session"
            size="large"
            fullWidth
            withIcon={option.isLive}
            aria-current={option.isSelected ? "true" : undefined}
            className={`table-session-option ${option.isSelected ? "is-active" : ""}`}
          >
            {option.meetingTitle}
          </ActionLink>
        ))}
      </div>
    </div>
  );
}
