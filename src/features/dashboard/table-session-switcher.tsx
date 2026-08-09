import Link from "next/link";
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
 * parametr nigdy nie jest źródłem uprawnień.
 *
 * Świadomie kompaktowy: to pasek pigułek NAD panelem, nie drugi wielki panel.
 */
export function TableSessionSwitcher({
  options,
}: {
  options: TableSessionOption[];
}) {
  if (options.length < 2) return null;

  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[0.56rem] font-bold tracking-[0.16em] text-[#e0b978] uppercase">
        Trwają {options.length} spotkania
      </span>

      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {options.map((option) => (
          <Link
            key={option.meetingId}
            href={option.href}
            aria-current={option.isSelected ? "true" : undefined}
            className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[0.62rem] font-bold transition ${
              option.isSelected
                ? "border-[#e9c27a] bg-[linear-gradient(180deg,rgba(58,36,24,0.96),rgba(36,21,13,0.98))] text-[#f7ecc9]"
                : "border-[#caa25a]/35 bg-[rgba(255,255,255,0.05)] text-[#d9c19a] hover:border-[#caa25a]/60 hover:text-[#f0dcb8]"
            }`}
          >
            {option.isLive ? <span aria-hidden="true">🔥</span> : null}
            <span className="truncate">
              {option.gameTitle ?? option.meetingTitle}
            </span>
            {option.gameTitle ? (
              <span className="truncate opacity-70">
                · {option.meetingTitle}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
