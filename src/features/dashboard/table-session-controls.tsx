"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { canUseNextImageOptimization } from "@/lib/image-sources";
import { useCanWrite } from "@/features/auth/member-role-context";
import {
  cancelMeetingPlayAction,
  finishMeetingAction,
  finishMeetingPlayAction,
  resumeMeetingPlayAction,
  startMeetingPlayAction,
} from "@/features/meetings/actions";
import {
  TABLE_SESSION_VISIBLE_CHOICES,
  formatPlayDurationLabel,
  type TableSessionGameChoice,
} from "@/features/meetings/live-play";

/*
 * Klienckie sterowanie sekcją „GRAMY!”. Cała reszta panelu jest serwerowa —
 * tutaj trafia tylko to, co naprawdę wymaga interakcji: wybór gry, decyzja
 * „kontynuujemy czy zaczynamy od nowa”, zamknięcie sesji i zamknięcie wieczoru.
 *
 * Żaden z tych przycisków nie prowadzi do formularza Kroniki. Wynik jest
 * osobną, dobrowolną czynnością — przy stole liczy się to, żeby jednym
 * kliknięciem powiedzieć „skończyliśmy”.
 */

function useTableAction() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (
    action: () => Promise<{ status: string; message?: string }>,
    onDone?: () => void,
  ) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") {
        setMessage(result.message ?? "Nie udało się wykonać tej operacji.");
        return;
      }

      onDone?.();
    });
  };

  return { message, pending, run };
}

function ActionMessage({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <p className="text-[0.65rem] font-semibold text-[#8f3528]">{message}</p>
  );
}

function GameChoiceTile({
  choice,
  isPending,
  onSelect,
}: {
  choice: TableSessionGameChoice;
  isPending: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={onSelect}
      className={`group flex min-w-0 items-center gap-2 rounded-[0.9rem] border px-2 py-1.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
        choice.isLeading
          ? "border-[#b4560f] bg-[linear-gradient(145deg,rgba(255,247,214,0.96),rgba(246,203,124,0.92))] shadow-[0_6px_16px_rgba(115,50,7,0.2)]"
          : "border-[#d8b98a] bg-[rgba(255,250,238,0.78)] hover:bg-[rgba(255,250,238,0.95)]"
      }`}
    >
      {choice.coverUrl ? (
        <Image
          src={choice.coverUrl}
          alt=""
          width={34}
          height={46}
          unoptimized={!canUseNextImageOptimization(choice.coverUrl)}
          className="h-[2.6rem] w-[1.95rem] shrink-0 rounded-[0.35rem] border border-[#dcc3a1] bg-[#f6ecdd] object-cover"
        />
      ) : (
        <span className="grid h-[2.6rem] w-[1.95rem] shrink-0 place-items-center rounded-[0.35rem] border border-dashed border-[#d2ba99] bg-[#f5ead9] text-[0.5rem] font-semibold text-[#8a6749]">
          ?
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.78rem] leading-tight font-bold text-[#5b3418]">
          {choice.title}
        </span>
        {choice.continuablePlay ? (
          <span className="mt-0.5 block truncate text-[0.6rem] leading-tight font-bold text-[#5c7a3f]">
            ▶ Macie zapisaną partię
          </span>
        ) : choice.badge ? (
          <span className="mt-0.5 block truncate text-[0.6rem] leading-tight font-semibold text-[#9a5117]">
            {choice.badge}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * Wybór gry, dla której istnieje odłożona rozgrywka, jest DWIEMA różnymi
 * decyzjami. Pytamy wprost — automatyczna kontynuacja po cichu doklejałaby
 * dzisiejszy wieczór do partii sprzed tygodnia, a automatyczny nowy start
 * gubiłby tamte godziny.
 */
function ContinuePrompt({
  choice,
  isPending,
  onContinue,
  onStartNew,
  onCancel,
}: {
  choice: TableSessionGameChoice;
  isPending: boolean;
  onContinue: () => void;
  onStartNew: () => void;
  onCancel: () => void;
}) {
  const saved = choice.continuablePlay;

  return (
    <div className="space-y-1.5 rounded-[0.9rem] border border-[#8aa06a] bg-[rgba(244,248,234,0.85)] px-2.5 py-2">
      <div>
        <p className="text-[0.72rem] font-bold text-[#3f5a2a]">
          Macie zapisaną partię — {choice.title}
        </p>
        <p className="text-[0.62rem] leading-snug text-[#4f6b39]">
          {saved?.accumulatedMinutes
            ? `Dotychczas rozegrane: ${formatPlayDurationLabel(saved.accumulatedMinutes)}.`
            : "Rozgrywka czeka na dokończenie."}
          {saved?.stateNote ? ` „${saved.stateNote}”` : ""}
        </p>
      </div>

      {/* Obok siebie zawsze (nie dopiero od sm:), tak jak "Trwają N spotkania"
          w TableSessionSwitcher — Kontynuuj partię z lewej (pierwsza w DOM). */}
      <div className="grid grid-cols-2 gap-1.5">
        <ActionButton
          type="button"
          action="chronicle"
          size="compact"
          withIcon={false}
          fullWidth
          disabled={isPending}
          onClick={onContinue}
        >
          ▶ Dokończ partię
        </ActionButton>
        <ActionButton
          type="button"
          action="newPlay"
          size="compact"
          withIcon={false}
          fullWidth
          disabled={isPending}
          onClick={onStartNew}
        >
          + Nowa partia
        </ActionButton>
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="text-[0.62rem] font-semibold text-[#5f6f4a] underline decoration-[#5f6f4a]/40 underline-offset-4"
      >
        Wróć do wyboru gry
      </button>
    </div>
  );
}

export function TableSessionGamePicker({
  meetingId,
  choices,
  autoOpen,
  idleLabel,
  renderIdleButton,
  showTopChoicesPreview = false,
  onOpenChange,
}: {
  meetingId: string;
  choices: TableSessionGameChoice[];
  autoOpen: boolean;
  idleLabel: string;
  /**
   * Niestandardowy wygląd zamkniętego CTA (np. heroicznie stylizowane
   * „Zaczynamy grać” na ekranie „drużyna przy stole”). Kliknięcie robi
   * dokładnie to samo co domyślny przycisk — otwiera picker — zmienia się
   * wyłącznie warstwa wizualna. Bez tego propa render jest identyczny jak
   * dotąd, więc pozostali odbiorcy komponentu (np. „Wybierz kolejną grę” w
   * podsumowaniu partii) nie widzą żadnej zmiany.
   */
  renderIdleButton?: (onClick: () => void) => React.ReactNode;
  /**
   * Tryb „Stołu”: TOP 3 propozycji jako przekrzywione okładki NAD zamkniętym
   * CTA, a otwarcie/zamknięcie pełnej listy animuje się (grid-template-rows
   * 0fr/1fr) zamiast być twardym podmieniem drzewa. Domyślnie false — reszta
   * odbiorców (np. „Wybierz kolejną grę” w podsumowaniu partii) ma
   * dokładnie dawne, natychmiastowe zachowanie bez dodatkowej warstwy.
   */
  showTopChoicesPreview?: boolean;
  /**
   * Pozwala rodzicowi zmienić WŁASNY layout wokół pickera, gdy lista się
   * otwiera/zamyka (np. „podsumowanie partii”, gdzie „Zagraj ponownie” ma
   * przenieść się znad połowicznej kolumny na cały wiersz nad rozwiniętą
   * listą). isOpen zostaje wewnętrznym stanem tego komponentu — to tylko
   * odbicie go na zewnątrz, nie kontrola z zewnątrz.
   */
  onOpenChange?: (isOpen: boolean) => void;
}) {
  const canWrite = useCanWrite();
  const [isOpen, setIsOpen] = useState(autoOpen);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingChoice, setPendingChoice] =
    useState<TableSessionGameChoice | null>(null);
  const { message, pending, run } = useTableAction();

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pl");
    if (normalized.length === 0) return choices;

    return choices.filter((choice) =>
      choice.title.toLocaleLowerCase("pl").includes(normalized),
    );
  }, [choices, query]);

  const visible =
    showAll || query.trim().length > 0
      ? filtered
      : filtered.slice(0, TABLE_SESSION_VISIBLE_CHOICES);
  const hiddenCount = filtered.length - visible.length;

  if (!canWrite) {
    return (
      <p className="text-[0.7rem] font-semibold text-[#8a4618]">
        To konto ma dostęp tylko do odczytu — partię rozpoczyna ktoś inny przy
        stole.
      </p>
    );
  }

  const startNew = (gameId: string) => {
    run(
      () => startMeetingPlayAction(meetingId, gameId),
      () => setPendingChoice(null),
    );
  };

  const resume = (playId: string) => {
    run(
      () => resumeMeetingPlayAction(meetingId, playId),
      () => setPendingChoice(null),
    );
  };

  const select = (choice: TableSessionGameChoice) => {
    if (choice.continuablePlay) {
      setPendingChoice(choice);
      return;
    }

    startNew(choice.gameId);
  };

  if (pendingChoice) {
    return (
      <div className="space-y-1.5">
        <ContinuePrompt
          choice={pendingChoice}
          isPending={pending}
          onContinue={() => resume(pendingChoice.continuablePlay?.playId ?? "")}
          onStartNew={() => startNew(pendingChoice.gameId)}
          onCancel={() => setPendingChoice(null)}
        />
        <ActionMessage message={message} />
      </div>
    );
  }

  const listContent =
    choices.length === 0 ? (
      <p className="text-[0.7rem] font-semibold text-[#8a4618]">
        Półka jest pusta — dodaj grę, zanim zaczniecie grać.
      </p>
    ) : (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          {showTopChoicesPreview ? (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[0.62rem] font-bold text-[#9a3d14] underline decoration-[#9a3d14]/35 underline-offset-4"
            >
              ‹ Zwiń do TOP 3
            </button>
          ) : (
            <p className="text-[0.56rem] font-bold tracking-[0.16em] text-[#a64d16] uppercase">
              W co gramy?
            </p>
          )}
          {choices.length > TABLE_SESSION_VISIBLE_CHOICES ? (
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Szukaj gry"
              aria-label="Szukaj gry na Półce"
              className="h-7 w-28 min-w-0 rounded-full border border-[#d8b98a] bg-[rgba(255,250,238,0.85)] px-2.5 text-[0.68rem] text-[#5b3418] outline-none focus:border-[#b4560f] sm:w-36"
            />
          ) : null}
        </div>

        <div className="grid gap-1.5 sm:grid-cols-2">
          {visible.map((choice) => (
            <GameChoiceTile
              key={choice.gameId}
              choice={choice}
              isPending={pending}
              onSelect={() => select(choice)}
            />
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="text-[0.68rem] text-[#7a4a24]">
            Nic nie pasuje do „{query.trim()}”.
          </p>
        ) : null}

        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-[0.66rem] font-bold text-[#9a3d14] underline decoration-[#9a3d14]/35 underline-offset-4"
          >
            Pokaż całą Półkę (+{hiddenCount})
          </button>
        ) : null}
      </div>
    );

  if (!showTopChoicesPreview) {
    // Dawne, niezmienione zachowanie: twarda podmiana drzewa, bez własnej
    // animacji (np. „Wybierz kolejną grę” w podsumowaniu partii).
    if (!isOpen) {
      return (
        <div className="space-y-1.5">
          {renderIdleButton ? (
            renderIdleButton(() => setIsOpen(true))
          ) : (
            <ActionButton
              type="button"
              action="newPlay"
              size="large"
              fullWidth
              onClick={() => setIsOpen(true)}
            >
              {idleLabel}
            </ActionButton>
          )}
          <ActionMessage message={message} />
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        {listContent}
        <ActionMessage message={message} />
      </div>
    );
  }

  // Tryb Stołu: obie strefy (TOP 3 + CTA / pełna lista) zostają w DOM cały
  // czas — tylko grid-template-rows/opacity się przełącza — żeby
  // grid-template-rows 0fr/1fr miało z czego animować w OBIE strony.
  const topChoices = choices.slice(0, 3);

  return (
    <div className="space-y-2.5">
      <div className={`table-picker-collapse ${!isOpen ? "is-expanded" : ""}`}>
        <div className="space-y-2.5">
          {topChoices.length > 0 ? (
            <TableTopCovers choices={topChoices} />
          ) : null}
          {renderIdleButton ? renderIdleButton(() => setIsOpen(true)) : null}
        </div>
      </div>

      <div className={`table-picker-collapse ${isOpen ? "is-expanded" : ""}`}>
        <div>{listContent}</div>
      </div>

      <ActionMessage message={message} />
    </div>
  );
}

/**
 * TOP 3 propozycji jako fizyczne pudełka rozłożone na stole — same okładki,
 * lekko przekrzywione (patrz .table-top-cover w globals.css), bez białych
 * kafli. Nazwa i liczba głosów subtelnie pod spodem; okładka zostaje
 * głównym elementem.
 */
function TableTopCovers({ choices }: { choices: TableSessionGameChoice[] }) {
  return (
    <div className="table-top-covers">
      {choices.map((choice) => (
        <div key={choice.gameId} className="table-top-cover-slot shrink">
          <div className="table-top-cover aspect-[45/61]">
            {choice.coverUrl ? (
              <Image
                src={choice.coverUrl}
                alt={choice.title}
                width={140}
                height={190}
                unoptimized={!canUseNextImageOptimization(choice.coverUrl)}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-[#f6ecdd] px-1.5 text-center text-[0.55rem] font-semibold text-[#8a6749]">
                Brak okładki
              </div>
            )}
          </div>
          <p className="mt-1.5 truncate text-center text-[0.62rem] font-bold text-[#f0dcb8]">
            {choice.title}
          </p>
          {choice.badge ? (
            <p className="truncate text-center text-[0.56rem] font-semibold text-[#c9a463]">
              {choice.badge}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Trzy wyjścia z „GRAMY!”, świadomie różnej wagi:
 *   „Zakończ partię” — rozgrywka skończona, wynik później (akcja główna),
 *   „Odłóż partię”   — wrócimy do niej na kolejnej sesji,
 *   „Zmień grę”      — kończy tę partię i od razu otwiera wybór kolejnej,
 *   „Anuluj start”   — pomyłka; drugorzędna i z potwierdzeniem, bo kasuje wpis.
 */
export function LivePlayControls({
  meetingId,
  playId,
  canManage,
  isContinuation,
}: {
  meetingId: string;
  playId: string;
  canManage: boolean;
  isContinuation: boolean;
}) {
  const canWrite = useCanWrite();
  const router = useRouter();
  const { message, pending, run } = useTableAction();

  if (!canWrite || !canManage) {
    return (
      <p className="text-[0.66rem] leading-snug font-semibold text-[#e0c8a8] [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
        Partiami tego wieczoru sterują jego uczestnicy.
      </p>
    );
  }

  const finish = (keepForLater: boolean) => {
    run(() => finishMeetingPlayAction(meetingId, playId, { keepForLater }));
  };

  const changeGame = () => {
    // Zmiana gry kończy bieżącą partię (wynik uzupełnimy później) i od razu
    // otwiera picker. Parametr w adresie przenosi tę intencję przez
    // przeładowanie sekcji, więc odświeżenie strony niczego nie gubi.
    //
    // `meeting` jedzie razem z `gra`: przy dwóch równoległych wieczorach sam
    // `?gra=wybor` zgubiłby wybór z przełącznika i mógłby przerzucić na drugie
    // spotkanie — czyli otworzyć wybór gry nie tam, gdzie użytkownik kliknął.
    run(
      () => finishMeetingPlayAction(meetingId, playId),
      () => router.replace(`/?meeting=${meetingId}&gra=wybor`),
    );
  };

  const cancel = () => {
    if (!window.confirm("Anulować tę partię? Nie trafi do Kroniki.")) return;
    run(() => cancelMeetingPlayAction(meetingId, playId));
  };

  return (
    <div className="space-y-1.5">
      {/* Obok siebie zawsze (nie dopiero od sm:), tak samo jak pozostałe pary
          głównych CTA na Stole. Odłóż partię z lewej = purple-button-new
          (.act-chronicle, ta sama plakietka co "Dokończ partię" w
          ContinuePrompt), Zakończ partię z prawej = red-button-new
          (.act-endPlay, osobny od .act-danger — ta plakietka nie jest
          niczym destrukcyjnym). size="large" dla wyraźnej ekspozycji obu,
          tej samej wysokości. */}
      <div className="grid grid-cols-2 gap-1.5">
        <ActionButton
          type="button"
          action="chronicle"
          size="large"
          withIcon={false}
          fullWidth
          disabled={pending}
          onClick={() => finish(true)}
        >
          Odłóż partię
        </ActionButton>
        <ActionButton
          type="button"
          action="endPlay"
          size="large"
          withIcon={false}
          fullWidth
          disabled={pending}
          loading={pending}
          loadingLabel="Zapisywanie..."
          onClick={() => finish(false)}
        >
          Zakończ partię
        </ActionButton>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={changeGame}
          className="text-[0.66rem] font-bold text-[#f0c88f] underline decoration-[#f0c88f]/45 underline-offset-4 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)] disabled:opacity-60"
        >
          Zmień grę
        </button>

        {/* Anulowanie kasuje wpis, więc nigdy nie stoi obok akcji głównej i
            nigdy nie dotyczy partii, która ma już wcześniejsze sesje. */}
        {isContinuation ? null : (
          <button
            type="button"
            disabled={pending}
            onClick={cancel}
            className="text-[0.66rem] font-semibold text-[#e2b3ba] underline decoration-[#e2b3ba]/45 underline-offset-4 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)] disabled:opacity-60"
          >
            Anuluj start
          </button>
        )}
      </div>

      <p className="text-[0.6rem] leading-snug text-[#e0c8a8] [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
        Wynik możesz uzupełnić później — „Zakończ partię” niczego nie wymusza.
      </p>

      <ActionMessage message={message} />
    </div>
  );
}

export function ResumePlayButton({
  meetingId,
  playId,
  label = "Wznów partię",
}: {
  meetingId: string;
  playId: string;
  label?: string;
}) {
  const canWrite = useCanWrite();
  const { message, pending, run } = useTableAction();

  if (!canWrite) return null;

  return (
    <div className="space-y-1">
      <ActionButton
        type="button"
        action="chronicle"
        size="large"
        withIcon={false}
        fullWidth
        disabled={pending}
        loading={pending}
        loadingLabel="Wznawianie..."
        onClick={() => run(() => resumeMeetingPlayAction(meetingId, playId))}
      >
        {label}
      </ActionButton>
      <ActionMessage message={message} />
    </div>
  );
}

/**
 * „Zagraj ponownie” — nowa partia tej samej gry. Zakończona zostaje w Kronice
 * nietknięta; to samo RPC co przy pierwszym starcie, więc nowy wpis dostaje
 * własny start i własny wynik.
 */
export function PlayAgainButton({
  meetingId,
  gameId,
  gameTitle,
}: {
  meetingId: string;
  gameId: string;
  gameTitle: string;
}) {
  const canWrite = useCanWrite();
  const { message, pending, run } = useTableAction();

  if (!canWrite) return null;

  return (
    <div className="space-y-1">
      <ActionButton
        type="button"
        action="replay"
        size="large"
        fullWidth
        disabled={pending}
        loading={pending}
        loadingLabel="Rozpoczynanie..."
        onClick={() => run(() => startMeetingPlayAction(meetingId, gameId))}
      >
        Zagraj ponownie
      </ActionButton>
      <p className="sr-only">Nowa partia: {gameTitle}</p>
      <ActionMessage message={message} />
    </div>
  );
}

export function FinishMeetingButton({
  meetingId,
  variant = "parchment",
}: {
  meetingId: string;
  /**
   * „wood” (nazwa historyczna — plakietka to dziś red-button-new, patrz
   * .act-finish w globals.css) jest tym, co widzą oba stany, które w ogóle
   * pokazują ten przycisk: „drużyna przy stole” i „podsumowanie” — obie
   * świadomie tym samym, czerwonym wariantem. Domyślny „parchment” (jasna
   * pergaminowa plakietka) nie ma dziś żadnego wołającego — zostaje jako
   * dawny, neutralny wygląd na wypadek przyszłego miejsca użycia poza
   * ciemnym tłem modułów Stołu, gdzie czerwień mogłaby wyglądać zbyt mocno.
   */
  variant?: "parchment" | "wood";
}) {
  const canWrite = useCanWrite();
  const { message, pending, run } = useTableAction();

  if (!canWrite) return null;

  const finish = () => {
    if (
      !window.confirm(
        "Zakończyć spotkanie? Rozegrane partie zostają w Kronice, a Stół wróci do kolejnego wieczoru.",
      )
    ) {
      return;
    }

    run(() => finishMeetingAction(meetingId));
  };

  if (variant === "wood") {
    return (
      <div className="space-y-1">
        <ActionButton
          type="button"
          action="finish"
          size="large"
          withIcon={false}
          fullWidth
          disabled={pending}
          loading={pending}
          loadingLabel="Kończenie..."
          onClick={finish}
        >
          Zakończ spotkanie
        </ActionButton>
        <ActionMessage message={message} />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <ActionButton
        type="button"
        action="neutral"
        size="large"
        emphasis="secondary"
        withIcon={false}
        fullWidth
        disabled={pending}
        loading={pending}
        loadingLabel="Kończenie..."
        onClick={finish}
      >
        Zakończ spotkanie
      </ActionButton>
      <ActionMessage message={message} />
    </div>
  );
}
