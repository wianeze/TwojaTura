// Rozszerzenie .ts jest tu wymagane: ten moduł ładuje bezpośrednio `node --test`
// (tests/unit), a resolver ESM Node'a nie dokleja rozszerzeń. Ta sama konwencja
// co w features/dashboard/formatting.ts.
import { getMeetingRecommendationLabel } from "./game-recommendations.ts";

/*
 * Stan „GRAMY!” — czysta logika sekcji spotkania na Stole.
 *
 * Sekcja spotkania nie jest osobną wyspą: to jeden panel przechodzący przez
 * kolejne stany tego samego wieczoru.
 *
 *   (brak)     — spotkanie jeszcze się nie zaczęło; Stół pokazuje dotychczasowy
 *                widok „Najbliższe spotkanie” i nic się nie zmienia,
 *   gathering  — godzina nadeszła, drużyna jest przy stole, nikt jeszcze nie
 *                wybrał gry,
 *   playing    — partia biegnie; licznik czasu liczy się z plays.live_started_at,
 *   summary    — ostatnia partia zapisana, wieczór trwa: można zagrać jeszcze
 *                raz, wybrać inną grę albo zakończyć spotkanie.
 *
 * Modul jest świadomie wolny od zależności serwerowych (żadnego Supabase,
 * next/*), żeby cała maszyna stanów dała się przetestować node --test.
 */

/**
 * Ile czasu po zaplanowanym końcu spotkanie nadal może zająć sekcję Stołu.
 *
 * Dwa przeciwstawne wymagania: (1) wieczór zaplanowany do 22:00 nie może zniknąć
 * z ekranu o 22:00, bo grupa zwykle gra dłużej niż zakładała, i (2) spotkanie
 * sprzed tygodnia, którego nikt nigdy nie rozpoczął, nie może blokować Stołu w
 * nieskończoność. Sześć godzin przykrywa typowe „gramy do drugiej w nocy”.
 *
 * Okno NIE dotyczy spotkania z biegnącą partią — ta trzyma sekcję dopóki nie
 * zostanie zapisany jej wynik, niezależnie od zegara.
 */
export const TABLE_SESSION_GRACE_MS = 6 * 60 * 60 * 1000;

export type TableSessionState = "gathering" | "playing" | "summary";

export type TableSessionCandidate = {
  id: string;
  startsAt: string;
  endsAt: string;
  hasLivePlay: boolean;
  hasFinishedPlay: boolean;
};

/*
 * Cztery rzeczy, które w danych wyglądają podobnie, a znaczą coś zupełnie
 * innego — i tylko razem ze statusem dają się rozróżnić:
 *
 *   running          gramy teraz, licznik biegnie,
 *   awaiting-result  zagraliśmy do końca, brakuje wyniku,
 *   paused           przerwaliśmy, wrócimy na kolejnej sesji,
 *   completed        rozliczone, historia.
 *
 * „Odłożona” obejmuje zarówno partię odłożoną przy stole, jak i tę zapisaną
 * ręcznie w Kronice jako „w toku” — z punktu widzenia kontynuacji to ten sam
 * stan i ta sama ścieżka powrotu do gry.
 */
export type PlayTablePhase =
  "running" | "awaiting-result" | "paused" | "completed";

export type PlayTableState = {
  status: "in_progress" | "completed";
  liveStartedAt: string | null;
  liveEndedAt: string | null;
  resultPending: boolean;
};

export function getPlayTablePhase(play: PlayTableState): PlayTablePhase {
  if (play.status === "completed") return "completed";
  if (play.resultPending) return "awaiting-result";
  if (play.liveStartedAt !== null && play.liveEndedAt === null) {
    return "running";
  }

  return "paused";
}

/**
 * Czy do tej rozgrywki można wrócić na kolejnej sesji. Ukończona partia jest
 * historią i nigdy nie wraca; partia czekająca na wynik też nie — jej rozgrywka
 * już się skończyła, brakuje wyłącznie rozliczenia. Lustro
 * `private.is_continuable_play` z bazy.
 */
export function isContinuablePlay(play: PlayTableState) {
  return getPlayTablePhase(play) === "paused";
}

/*
 * Odłożona rozgrywka, do której można wrócić wybierając tę samą grę. Obecność
 * tego pola w propozycji NIE oznacza, że kontynuacja zostanie wybrana
 * automatycznie — picker pyta wprost, bo „jeszcze raz w to samo” i „wracamy do
 * tamtej partii” to dwie różne decyzje.
 */
export type TableSessionContinuablePlay = {
  playId: string;
  stateNote: string | null;
  playedAt: string;
  accumulatedMinutes: number | null;
};

export type TableSessionGameChoice = {
  gameId: string;
  title: string;
  coverUrl: string | null;
  badge: string | null;
  isLeading: boolean;
  continuablePlay: TableSessionContinuablePlay | null;
};

export type TableSessionResultTone = "win" | "loss" | "neutral";

function toTime(iso: string) {
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * Czy to spotkanie zajmuje teraz sekcję Stołu i w jakim stanie.
 *
 * Biegnąca partia wygrywa zawsze — także wtedy, gdy zaplanowany koniec
 * spotkania dawno minął. Bez tego wynik trwającej gry przepadłby razem ze
 * znikającą sekcją.
 */
export function resolveTableSessionState(
  meeting: TableSessionCandidate,
  now: Date,
): TableSessionState | null {
  if (meeting.hasLivePlay) return "playing";

  const startsAt = toTime(meeting.startsAt);
  const endsAt = toTime(meeting.endsAt);
  if (startsAt === null || endsAt === null) return null;

  const nowTime = now.getTime();

  // Przed godziną rozpoczęcia Stół zostaje przy dotychczasowym widoku
  // najbliższego spotkania — to jest wprost wymagany stan „przed spotkaniem”.
  if (nowTime < startsAt) return null;
  if (nowTime >= endsAt + TABLE_SESSION_GRACE_MS) return null;

  return meeting.hasFinishedPlay ? "summary" : "gathering";
}

/**
 * WSZYSTKIE wieczory, które mogą teraz zająć sekcję Stołu, w kolejności
 * ważności: aktywna partia bije wszystko, przy remisie wygrywa wieczór
 * kończący się najwcześniej (czyli ten najbliżej „teraz”).
 *
 * Wołający musi podać wyłącznie spotkania, w których widz bierze udział —
 * kolejność jest tu tylko podpowiedzią, nie filtrem uprawnień. Zwracamy całą
 * listę, a nie sam pierwszy element, bo dwie równoległe grupy to nie błąd:
 * użytkownik należący do obu musi mieć dostęp do obu, a nie tylko do tej z
 * wcześniejszym `ends_at`.
 */
export function listTableSessions<T extends TableSessionCandidate>(
  meetings: T[],
  now: Date,
): Array<{ meeting: T; state: TableSessionState }> {
  return meetings
    .flatMap((meeting) => {
      const state = resolveTableSessionState(meeting, now);
      return state === null ? [] : [{ meeting, state }];
    })
    .sort((left, right) => {
      const leftRank = left.state === "playing" ? 0 : 1;
      const rightRank = right.state === "playing" ? 0 : 1;
      if (leftRank !== rightRank) return leftRank - rightRank;

      return (
        (toTime(left.meeting.endsAt) ?? 0) - (toTime(right.meeting.endsAt) ?? 0)
      );
    });
}

/**
 * Które spotkanie przejmuje sekcję.
 *
 * `preferredMeetingId` to wybór użytkownika z przełącznika (jedzie w adresie,
 * patrz `?meeting=`). Honorujemy go WYŁĄCZNIE wtedy, gdy to spotkanie jest na
 * liście kandydatów — a ta jest już zawężona do wieczorów widza, więc obcy
 * identyfikator z adresu po prostu nie ma czego trafić i wracamy do domyślnego
 * wyboru. Parametr z URL nigdy nie jest tu źródłem uprawnień.
 */
export function pickTableSession<T extends TableSessionCandidate>(
  meetings: T[],
  now: Date,
  options: { preferredMeetingId?: string | null } = {},
): { meeting: T; state: TableSessionState } | null {
  const candidates = listTableSessions(meetings, now);
  const preferred = options.preferredMeetingId
    ? candidates.find(
        (candidate) => candidate.meeting.id === options.preferredMeetingId,
      )
    : null;

  return preferred ?? candidates[0] ?? null;
}

/**
 * Licznik partii: HH:MM:SS liczone WYŁĄCZNIE z zapisanego startu, nigdy z
 * lokalnego stanu komponentu. Odświeżenie strony i wejście z innego urządzenia
 * pokazują tę samą wartość.
 */
export function formatLiveElapsed(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function getLiveElapsedMs(startedAt: string, now: Date) {
  const startedAtTime = toTime(startedAt);
  if (startedAtTime === null) return 0;

  return Math.max(0, now.getTime() - startedAtTime);
}

/**
 * Czas trwania podpowiadany w formularzu zakończenia partii. Minuta to
 * minimum — partia zapisana z zerem nie przeszłaby walidacji
 * (assert_valid_play_payload wymaga wartości dodatniej).
 */
export function toLivePlayDurationMinutes(startedAt: string, now: Date) {
  const startedAtTime = toTime(startedAt);
  if (startedAtTime === null) return null;

  return Math.max(1, Math.round((now.getTime() - startedAtTime) / 60_000));
}

/**
 * Czas jednej sesji przy stole i łączny czas rozgrywki.
 *
 * `accumulatedMinutes` (plays.duration_minutes) to suma zamkniętych sesji —
 * kontynuacja NIE zaczyna liczyć od zera. Bieżąca sesja dokłada się do niej
 * dopiero po zamknięciu, więc w trakcie gry sumujemy je tutaj.
 */
export function getLivePlayTimes(input: {
  startedAt: string;
  accumulatedMinutes: number | null;
  now: Date;
}) {
  const sessionMs = getLiveElapsedMs(input.startedAt, input.now);
  const accumulated = input.accumulatedMinutes ?? 0;

  return {
    sessionMs,
    sessionMinutes: Math.max(1, Math.round(sessionMs / 60_000)),
    accumulatedMinutes: accumulated,
    totalMinutes: accumulated + Math.round(sessionMs / 60_000),
    isContinuation: accumulated > 0,
  };
}

export function formatPlayDurationLabel(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes) || minutes <= 0) {
    return "Czas nieznany";
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours}h`;

  return `${hours}h ${rest} min`;
}

/**
 * Podsumowanie zakończonej partii w języku wieczoru, nie formularza. Kooperacja
 * ma wynik drużyny, rywalizacja — zwycięzców; obie ścieżki pochodzą z tego
 * samego modelu Kroniki, bez własnego pojęcia „wyniku”.
 */
export function buildFinishedPlayResult(input: {
  mode: "competitive" | "cooperative";
  teamResult: "win" | "loss" | null;
  winnerNames: string[];
  viewerIsWinner: boolean;
}): { label: string; tone: TableSessionResultTone } {
  if (input.mode === "cooperative") {
    if (input.teamResult === "win") {
      return { label: "🏆 ZWYCIĘSTWO", tone: "win" };
    }

    if (input.teamResult === "loss") {
      return { label: "☠️ PORAŻKA", tone: "loss" };
    }

    return { label: "Bez rozstrzygnięcia", tone: "neutral" };
  }

  if (input.viewerIsWinner) {
    return { label: "🏆 ZWYCIĘSTWO", tone: "win" };
  }

  if (input.winnerNames.length === 0) {
    return { label: "Bez rozstrzygnięcia", tone: "neutral" };
  }

  return { label: `🏆 ${input.winnerNames.join(", ")}`, tone: "neutral" };
}

type TableSessionVote = {
  gameId: string;
  title: string;
  coverUrl: string | null;
  yesCount: number;
};

type TableSessionRecommendation = {
  gameId: string;
  title: string;
  coverUrl: string | null;
  label: "team-favorite" | "good-fit" | "team-sure-thing";
};

type TableSessionGame = {
  gameId: string;
  title: string;
  coverUrl: string | null;
};

export type TableSessionContinuableGame = TableSessionContinuablePlay &
  TableSessionGame;

/**
 * Lista gier do wyboru przy stole: najpierw to, co drużyna sama przegłosowała,
 * potem podpowiedzi istniejącego sugerowacza dla tej konkretnej ekipy, na końcu
 * reszta Półki (żeby wieczór nie utknął, gdy grupa chce zagrać w coś spoza
 * głosowania).
 *
 * Ten kod NICZEGO nie punktuje ani nie sortuje po swojemu — kolejność
 * głosowania ustala sortMeetingRanking, a kolejność i etykiety rekomendacji
 * buildMeetingGameRecommendations. Tutaj następuje wyłącznie sklejenie list i
 * usunięcie duplikatów.
 */
export function buildTableSessionGameChoices(input: {
  votes: TableSessionVote[];
  recommendations: TableSessionRecommendation[];
  otherGames?: TableSessionGame[];
  /** Odłożone rozgrywki, z których każda wskazuje swoją grę. */
  continuablePlays?: TableSessionContinuableGame[];
}): TableSessionGameChoice[] {
  const leadingGameId =
    input.votes.find((vote) => vote.yesCount > 0)?.gameId ?? null;
  const continuableByGame = new Map<string, TableSessionContinuablePlay>();
  for (const play of input.continuablePlays ?? []) {
    const current = continuableByGame.get(play.gameId);
    if (
      !current ||
      new Date(play.playedAt).getTime() > new Date(current.playedAt).getTime()
    ) {
      continuableByGame.set(play.gameId, {
        playId: play.playId,
        stateNote: play.stateNote,
        playedAt: play.playedAt,
        accumulatedMinutes: play.accumulatedMinutes,
      });
    }
  }

  const seen = new Set<string>();
  const choices: TableSessionGameChoice[] = [];
  const push = (
    game: TableSessionGame,
    badge: string | null,
    isLeading: boolean,
  ) => {
    if (seen.has(game.gameId)) return;
    seen.add(game.gameId);

    choices.push({
      gameId: game.gameId,
      title: game.title,
      coverUrl: game.coverUrl,
      badge,
      isLeading,
      continuablePlay: continuableByGame.get(game.gameId) ?? null,
    });
  };

  for (const vote of input.votes) {
    push(
      vote,
      vote.yesCount > 0 ? `${vote.yesCount} chce grać` : null,
      vote.gameId === leadingGameId,
    );
  }

  for (const recommendation of input.recommendations) {
    push(
      recommendation,
      getMeetingRecommendationLabel(recommendation.label),
      false,
    );
  }

  for (const game of input.otherGames ?? []) {
    push(game, null, false);
  }

  // Odłożona rozgrywka nie może wypaść z listy tylko dlatego, że jej gra
  // zniknęła z Półki albo z głosowania — inaczej nie dałoby się do niej wrócić.
  for (const play of input.continuablePlays ?? []) {
    push(play, null, false);
  }

  return choices;
}

/**
 * Ile propozycji pokazać od razu. Reszta czeka pod „Pokaż całą Półkę”, żeby
 * sekcja nie urosła na wysokość ekranu.
 */
export const TABLE_SESSION_VISIBLE_CHOICES = 6;
