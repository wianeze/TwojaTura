import assert from "node:assert/strict";
import test from "node:test";
import {
  TABLE_SESSION_GRACE_MS,
  buildFinishedPlayResult,
  buildTableSessionGameChoices,
  formatLiveElapsed,
  formatPlayDurationLabel,
  getLiveElapsedMs,
  getLivePlayTimes,
  getPlayTablePhase,
  isContinuablePlay,
  listTableSessions,
  pickTableSession,
  resolveTableSessionState,
  toLivePlayDurationMinutes,
} from "../../src/features/meetings/live-play.ts";
import type {
  PlayTableState,
  TableSessionCandidate,
} from "../../src/features/meetings/live-play.ts";

/*
 * Kontrakt stanu „GRAMY!”. Reguły bazodanowe (jedna aktywna partia na
 * spotkanie, idempotencja startu, naliczenie punktów dokładnie raz) mają swój
 * własny zestaw w supabase/tests/database/013_live_meeting_plays.test.sql —
 * tutaj sprawdzamy maszynę stanów sekcji i sposób liczenia czasu.
 */

const MEETING_STARTS_AT = "2026-08-09T16:00:00.000Z";
const MEETING_ENDS_AT = "2026-08-09T21:00:00.000Z";

function buildCandidate(
  overrides: Partial<TableSessionCandidate> = {},
): TableSessionCandidate {
  return {
    id: "meeting-1",
    startsAt: MEETING_STARTS_AT,
    endsAt: MEETING_ENDS_AT,
    hasLivePlay: false,
    hasFinishedPlay: false,
    ...overrides,
  };
}

// --- 1. Przed spotkaniem: Stół wygląda jak dotąd ---------------------------

test("a meeting that has not started yet does not take over the table", () => {
  assert.equal(
    resolveTableSessionState(
      buildCandidate(),
      new Date("2026-08-09T15:59:59.000Z"),
    ),
    null,
  );
});

// --- 2. Nadejście godziny: spotkanie NIE znika ------------------------------

test("the meeting stays on the table the moment its hour arrives", () => {
  assert.equal(
    resolveTableSessionState(
      buildCandidate(),
      new Date("2026-08-09T16:00:00.000Z"),
    ),
    "gathering",
  );
});

test("the meeting stays on the table past its scheduled end, within the grace window", () => {
  const justAfterEnd = new Date("2026-08-09T21:00:01.000Z");

  assert.equal(
    resolveTableSessionState(buildCandidate(), justAfterEnd),
    "gathering",
  );
});

// --- 3./4. Start partii i licznik czasu ------------------------------------

test("a running play puts the section into the GRAMY! state", () => {
  assert.equal(
    resolveTableSessionState(
      buildCandidate({ hasLivePlay: true }),
      new Date("2026-08-09T18:30:00.000Z"),
    ),
    "playing",
  );
});

test("a running play keeps the section alive long after the meeting was due to end", () => {
  const wayPastGrace = new Date(
    new Date(MEETING_ENDS_AT).getTime() + TABLE_SESSION_GRACE_MS * 3,
  );

  assert.equal(
    resolveTableSessionState(
      buildCandidate({ hasLivePlay: true }),
      wayPastGrace,
    ),
    "playing",
  );
});

test("elapsed time is derived from the stored start, so a refresh cannot reset it", () => {
  const startedAt = "2026-08-09T18:14:00.000Z";

  // Dwa niezależne „rendery” (odświeżenie strony, drugie urządzenie) liczą to
  // samo, bo jedynym wejściem jest zapisany start partii.
  const firstRender = getLiveElapsedMs(
    startedAt,
    new Date("2026-08-09T19:51:22.000Z"),
  );
  const afterRefresh = getLiveElapsedMs(
    startedAt,
    new Date("2026-08-09T19:51:22.000Z"),
  );

  assert.equal(firstRender, afterRefresh);
  assert.equal(formatLiveElapsed(firstRender), "01:37:22");
});

test("elapsed time keeps counting past 24 hours instead of wrapping around", () => {
  assert.equal(formatLiveElapsed(26 * 3_600_000 + 61_000), "26:01:01");
});

test("a clock skewed backwards shows zero rather than a negative timer", () => {
  assert.equal(
    formatLiveElapsed(
      getLiveElapsedMs(
        "2026-08-09T19:00:00.000Z",
        new Date("2026-08-09T18:59:00.000Z"),
      ),
    ),
    "00:00:00",
  );
});

test("finishing a play suggests the real elapsed duration, never zero", () => {
  assert.equal(
    toLivePlayDurationMinutes(
      "2026-08-09T18:14:00.000Z",
      new Date("2026-08-09T20:57:00.000Z"),
    ),
    163,
  );

  // Partia zamknięta natychmiast po starcie nie może zaproponować 0 minut —
  // baza odrzuca czas trwania <= 0.
  assert.equal(
    toLivePlayDurationMinutes(
      "2026-08-09T18:14:00.000Z",
      new Date("2026-08-09T18:14:05.000Z"),
    ),
    1,
  );
});

test("duration reads like a game night, not like a number of minutes", () => {
  assert.equal(formatPlayDurationLabel(163), "2h 43 min");
  assert.equal(formatPlayDurationLabel(47), "47 min");
  assert.equal(formatPlayDurationLabel(120), "2h");
  assert.equal(formatPlayDurationLabel(null), "Czas nieznany");
});

// --- 6./7. Po zapisaniu wyniku ---------------------------------------------

test("once a play is saved the section switches to the summary state", () => {
  assert.equal(
    resolveTableSessionState(
      buildCandidate({ hasLivePlay: false, hasFinishedPlay: true }),
      new Date("2026-08-09T20:00:00.000Z"),
    ),
    "summary",
  );
});

test("cooperative results keep the existing WIN/LOST meaning", () => {
  assert.deepEqual(
    buildFinishedPlayResult({
      mode: "cooperative",
      teamResult: "win",
      winnerNames: ["Marta", "Michał"],
      viewerIsWinner: true,
    }),
    { label: "🏆 ZWYCIĘSTWO", tone: "win" },
  );

  assert.deepEqual(
    buildFinishedPlayResult({
      mode: "cooperative",
      teamResult: "loss",
      winnerNames: [],
      viewerIsWinner: false,
    }),
    { label: "☠️ PORAŻKA", tone: "loss" },
  );
});

test("competitive results name the winner when it is not the viewer", () => {
  assert.deepEqual(
    buildFinishedPlayResult({
      mode: "competitive",
      teamResult: null,
      winnerNames: ["Michał"],
      viewerIsWinner: false,
    }),
    { label: "🏆 Michał", tone: "neutral" },
  );

  assert.deepEqual(
    buildFinishedPlayResult({
      mode: "competitive",
      teamResult: null,
      winnerNames: ["Marta"],
      viewerIsWinner: true,
    }),
    { label: "🏆 ZWYCIĘSTWO", tone: "win" },
  );
});

// --- 8./9. Kolejne partie tego samego wieczoru ------------------------------

test("a finished play does not end the evening — the table stays open", () => {
  const state = resolveTableSessionState(
    buildCandidate({ hasFinishedPlay: true }),
    new Date("2026-08-09T22:30:00.000Z"),
  );

  // Po zaplanowanym końcu, ale w oknie tolerancji: wieczór trwa, więc dalej
  // można zacząć kolejną partię albo zamknąć spotkanie.
  assert.equal(state, "summary");
});

test("a new live play wins over the summary of the previous one", () => {
  assert.equal(
    resolveTableSessionState(
      buildCandidate({ hasLivePlay: true, hasFinishedPlay: true }),
      new Date("2026-08-09T22:30:00.000Z"),
    ),
    "playing",
  );
});

// --- 10./11. Wybór wieczoru, który zajmuje sekcję ---------------------------

test("a running play wins over another meeting that is merely under way", () => {
  const picked = pickTableSession(
    [
      buildCandidate({
        id: "just-started",
        startsAt: "2026-08-09T20:00:00.000Z",
        endsAt: "2026-08-09T23:00:00.000Z",
      }),
      buildCandidate({
        id: "playing",
        startsAt: "2026-08-09T16:00:00.000Z",
        endsAt: "2026-08-09T21:00:00.000Z",
        hasLivePlay: true,
      }),
    ],
    new Date("2026-08-09T20:30:00.000Z"),
  );

  assert.equal(picked?.meeting.id, "playing");
  assert.equal(picked?.state, "playing");
});

test("an old meeting nobody ever started stops blocking the table", () => {
  const lastWeek = buildCandidate({
    id: "abandoned",
    startsAt: "2026-08-01T16:00:00.000Z",
    endsAt: "2026-08-01T21:00:00.000Z",
  });

  assert.equal(
    resolveTableSessionState(lastWeek, new Date("2026-08-09T12:00:00.000Z")),
    null,
  );
  assert.equal(
    pickTableSession([lastWeek], new Date("2026-08-09T12:00:00.000Z")),
    null,
  );
});

test("the grace window has a hard edge, not an open end", () => {
  const meeting = buildCandidate();
  const endsAt = new Date(MEETING_ENDS_AT).getTime();

  assert.equal(
    resolveTableSessionState(
      meeting,
      new Date(endsAt + TABLE_SESSION_GRACE_MS - 1000),
    ),
    "gathering",
  );
  assert.equal(
    resolveTableSessionState(
      meeting,
      new Date(endsAt + TABLE_SESSION_GRACE_MS),
    ),
    null,
  );
});

test("nothing holds the table when no meeting qualifies", () => {
  assert.equal(
    pickTableSession([], new Date("2026-08-09T18:00:00.000Z")),
    null,
  );
});

// --- Równoległe wieczory dwóch różnych grup ---------------------------------
//
// Wejściem tych funkcji są WYŁĄCZNIE spotkania, w których widz bierze udział —
// zawężenie robi getTableSession przez getViewerMeetingParticipation, zanim
// cokolwiek tu trafi. Poniższe testy pilnują drugiej połowy kontraktu: że mając
// już swoją listę, nikt nie zostanie z niej wypchnięty przez cudzy wieczór ani
// przez podrzucony identyfikator z adresu.

const PARALLEL_A = buildCandidate({
  id: "meeting-a",
  startsAt: "2026-08-09T16:00:00.000Z",
  endsAt: "2026-08-09T20:00:00.000Z",
  hasLivePlay: true,
});

const PARALLEL_B = buildCandidate({
  id: "meeting-b",
  // Kończy się WCZEŚNIEJ niż A — dokładnie ten warunek potrafił wcześniej
  // odebrać sekcję grupie A.
  startsAt: "2026-08-09T16:30:00.000Z",
  endsAt: "2026-08-09T19:30:00.000Z",
  hasLivePlay: true,
});

const PARALLEL_NOW = new Date("2026-08-09T18:00:00.000Z");

test("a viewer who belongs only to meeting A gets meeting A", () => {
  const picked = pickTableSession([PARALLEL_A], PARALLEL_NOW);

  assert.equal(picked?.meeting.id, "meeting-a");
  assert.equal(picked?.state, "playing");
});

test("a running play in someone else's meeting never takes over the table", () => {
  // Widz należy tylko do A. B biegnie równolegle i kończy się wcześniej, ale
  // nie ma go na liście widza, więc nie ma jak przejąć sekcji.
  const picked = pickTableSession([PARALLEL_A], PARALLEL_NOW);

  assert.equal(picked?.meeting.id, "meeting-a");
});

test("a viewer who belongs only to meeting B gets meeting B", () => {
  assert.equal(
    pickTableSession([PARALLEL_B], PARALLEL_NOW)?.meeting.id,
    "meeting-b",
  );
});

test("an outsider to both parallel meetings gets no table session at all", () => {
  assert.equal(pickTableSession([], PARALLEL_NOW), null);
});

test("two parallel meetings can both be live — neither is hidden", () => {
  const sessions = listTableSessions([PARALLEL_A, PARALLEL_B], PARALLEL_NOW);

  assert.equal(sessions.length, 2);
  assert.deepEqual(
    sessions.map((session) => session.state),
    ["playing", "playing"],
  );
  // Obie są dostępne; kolejność to tylko podpowiedź, nie ukrycie jednej z nich.
  assert.deepEqual([...sessions.map((session) => session.meeting.id)].sort(), [
    "meeting-a",
    "meeting-b",
  ]);
});

test("the switcher can select the meeting that default ordering did not pick", () => {
  const meetings = [PARALLEL_A, PARALLEL_B];
  const byDefault = pickTableSession(meetings, PARALLEL_NOW);
  const switched = pickTableSession(meetings, PARALLEL_NOW, {
    preferredMeetingId: "meeting-a",
  });

  // Domyślnie wygrywa wieczór kończący się wcześniej…
  assert.equal(byDefault?.meeting.id, "meeting-b");
  // …ale wybór z przełącznika ma pierwszeństwo.
  assert.equal(switched?.meeting.id, "meeting-a");
});

test("the same query param yields the same meeting after a refresh", () => {
  const meetings = [PARALLEL_A, PARALLEL_B];
  const first = pickTableSession(meetings, PARALLEL_NOW, {
    preferredMeetingId: "meeting-a",
  });
  const afterRefresh = pickTableSession(
    meetings,
    new Date("2026-08-09T18:05:00.000Z"),
    { preferredMeetingId: "meeting-a" },
  );

  assert.equal(first?.meeting.id, "meeting-a");
  assert.equal(afterRefresh?.meeting.id, "meeting-a");
});

test("a meeting id from the URL cannot open a session the viewer is not in", () => {
  // Lista zawiera wyłącznie wieczory widza, więc obcy identyfikator nie ma
  // czego trafić — wracamy do domyślnego wyboru zamiast otwierać cudzy stół.
  const picked = pickTableSession([PARALLEL_A], PARALLEL_NOW, {
    preferredMeetingId: "meeting-b",
  });

  assert.equal(picked?.meeting.id, "meeting-a");
});

test("a single-meeting evening is unaffected by the switcher plumbing", () => {
  const solo = buildCandidate({ id: "solo" });
  const sessions = listTableSessions([solo], PARALLEL_NOW);

  assert.equal(sessions.length, 1);
  assert.equal(pickTableSession([solo], PARALLEL_NOW)?.meeting.id, "solo");
  // Nieistotny parametr z adresu nie psuje pojedynczego wieczoru.
  assert.equal(
    pickTableSession([solo], PARALLEL_NOW, { preferredMeetingId: "obcy" })
      ?.meeting.id,
    "solo",
  );
});

// --- Cztery stany partii przy stole ----------------------------------------

function buildPlayState(
  overrides: Partial<PlayTableState> = {},
): PlayTableState {
  return {
    status: "in_progress",
    liveStartedAt: "2026-08-09T18:14:00.000Z",
    liveEndedAt: null,
    resultPending: false,
    ...overrides,
  };
}

test("a play being played right now is the only one that reads as running", () => {
  assert.equal(getPlayTablePhase(buildPlayState()), "running");
});

test("finishing without a result is neither running nor completed", () => {
  const play = buildPlayState({
    liveEndedAt: "2026-08-09T20:57:00.000Z",
    resultPending: true,
  });

  assert.equal(getPlayTablePhase(play), "awaiting-result");
  assert.equal(play.status, "in_progress");
});

test("paused and result-pending entries have distinct labels but are both continuable", () => {
  const paused = buildPlayState({ liveEndedAt: "2026-08-09T20:57:00.000Z" });
  const awaiting = buildPlayState({
    liveEndedAt: "2026-08-09T20:57:00.000Z",
    resultPending: true,
  });

  assert.equal(getPlayTablePhase(paused), "paused");
  assert.equal(getPlayTablePhase(awaiting), "awaiting-result");
  assert.equal(isContinuablePlay(paused), true);
  assert.equal(isContinuablePlay(awaiting), true);
});

test("a play parked from the Chronicle, with no live marker at all, stays continuable", () => {
  const parked = buildPlayState({ liveStartedAt: null });

  assert.equal(getPlayTablePhase(parked), "paused");
  assert.equal(isContinuablePlay(parked), true);
});

test("a play parked from the Table is continuable after its live session ends", () => {
  const parked = buildPlayState({
    liveStartedAt: "2026-08-09T18:00:00.000Z",
    liveEndedAt: "2026-08-09T20:57:00.000Z",
    resultPending: false,
  });

  assert.equal(getPlayTablePhase(parked), "paused");
  assert.equal(isContinuablePlay(parked), true);
});

test("a completed play is history and can never be resumed", () => {
  const completed = buildPlayState({
    status: "completed",
    liveEndedAt: "2026-08-09T20:57:00.000Z",
  });

  assert.equal(getPlayTablePhase(completed), "completed");
  assert.equal(isContinuablePlay(completed), false);
});

// --- Czas sesji kontra czas całej rozgrywki ---------------------------------

test("a continued play reports today's session and the running total separately", () => {
  const times = getLivePlayTimes({
    startedAt: "2026-08-09T19:00:00.000Z",
    accumulatedMinutes: 205,
    now: new Date("2026-08-09T20:12:00.000Z"),
  });

  assert.equal(times.sessionMinutes, 72);
  assert.equal(times.accumulatedMinutes, 205);
  assert.equal(times.totalMinutes, 277);
  assert.equal(times.isContinuation, true);
  assert.equal(formatPlayDurationLabel(times.sessionMinutes), "1h 12 min");
  assert.equal(formatPlayDurationLabel(times.totalMinutes), "4h 37 min");
});

test("a first session has no history to carry, so both times agree", () => {
  const times = getLivePlayTimes({
    startedAt: "2026-08-09T19:00:00.000Z",
    accumulatedMinutes: null,
    now: new Date("2026-08-09T20:12:00.000Z"),
  });

  assert.equal(times.accumulatedMinutes, 0);
  assert.equal(times.totalMinutes, 72);
  assert.equal(times.isContinuation, false);
});

// --- Wybór gry: głosowanie, potem sugerowacz, potem reszta Półki ------------

test("game choices follow the group's own vote before anything else", () => {
  const choices = buildTableSessionGameChoices({
    votes: [
      {
        gameId: "frostpunk",
        title: "Frostpunk",
        coverUrl: "/frostpunk.webp",
        yesCount: 4,
      },
      { gameId: "heat", title: "Heat", coverUrl: null, yesCount: 2 },
      { gameId: "scout", title: "Scout", coverUrl: null, yesCount: 0 },
    ],
    recommendations: [
      {
        gameId: "nemesis",
        title: "Nemesis",
        coverUrl: null,
        label: "team-favorite",
      },
    ],
    otherGames: [{ gameId: "xcom", title: "XCOM", coverUrl: null }],
  });

  assert.deepEqual(
    choices.map((choice) => choice.gameId),
    ["frostpunk", "heat", "scout", "nemesis", "xcom"],
  );
  assert.equal(choices[0]?.isLeading, true);
  assert.equal(choices[0]?.badge, "4 chce grać");
  assert.equal(choices[2]?.badge, null);
  assert.equal(choices[3]?.badge, "🔥 Faworyt drużyny");
  assert.equal(choices[4]?.badge, null);
});

test("a game already voted on is never offered twice", () => {
  const choices = buildTableSessionGameChoices({
    votes: [{ gameId: "heat", title: "Heat", coverUrl: null, yesCount: 3 }],
    recommendations: [
      { gameId: "heat", title: "Heat", coverUrl: null, label: "good-fit" },
    ],
    otherGames: [{ gameId: "heat", title: "Heat", coverUrl: null }],
  });

  assert.equal(choices.length, 1);
  assert.equal(choices[0]?.badge, "3 chce grać");
});

test("a game with a parked play is flagged, but never auto-continued", () => {
  const choices = buildTableSessionGameChoices({
    votes: [
      {
        gameId: "frostpunk",
        title: "Frostpunk",
        coverUrl: null,
        yesCount: 3,
      },
    ],
    recommendations: [],
    otherGames: [{ gameId: "heat", title: "Heat", coverUrl: null }],
    continuablePlays: [
      {
        gameId: "frostpunk",
        title: "Frostpunk",
        coverUrl: null,
        playId: "play-frostpunk",
        stateNote: "Runda 3 z 5",
        playedAt: "2026-08-02T18:00:00.000Z",
        accumulatedMinutes: 180,
      },
    ],
  });

  const frostpunk = choices.find((choice) => choice.gameId === "frostpunk");
  const heat = choices.find((choice) => choice.gameId === "heat");

  // Sam wybór gry nie rozstrzyga „kontynuujemy czy zaczynamy nową” — picker ma
  // o to zapytać, więc propozycja niesie obie możliwości naraz.
  assert.equal(frostpunk?.continuablePlay?.playId, "play-frostpunk");
  assert.equal(frostpunk?.continuablePlay?.accumulatedMinutes, 180);
  assert.equal(frostpunk?.gameId, "frostpunk");
  assert.equal(heat?.continuablePlay, null);
});

test("same-game parked plays stay separate and the freshest is shown first", () => {
  const choices = buildTableSessionGameChoices({
    votes: [],
    recommendations: [],
    continuablePlays: [
      {
        gameId: "frostpunk",
        title: "Frostpunk",
        coverUrl: null,
        playId: "older",
        stateNote: null,
        playedAt: "2026-07-01T18:00:00.000Z",
        accumulatedMinutes: 60,
      },
      {
        gameId: "frostpunk",
        title: "Frostpunk",
        coverUrl: null,
        playId: "newer",
        stateNote: null,
        playedAt: "2026-08-02T18:00:00.000Z",
        accumulatedMinutes: 180,
      },
    ],
  });

  assert.equal(choices.length, 1);
  assert.equal(choices[0]?.continuablePlay?.playId, "newer");
  assert.deepEqual(
    choices[0]?.continuablePlays.map((play) => play.playId),
    ["newer", "older"],
  );
});

test("a parked play stays reachable even when its game left the shelf", () => {
  const choices = buildTableSessionGameChoices({
    votes: [],
    recommendations: [],
    otherGames: [],
    continuablePlays: [
      {
        gameId: "gloomhaven",
        title: "Gloomhaven",
        coverUrl: null,
        playId: "play-gloomhaven",
        stateNote: null,
        playedAt: "2026-08-02T18:00:00.000Z",
        accumulatedMinutes: 240,
      },
    ],
  });

  assert.equal(choices.length, 1);
  assert.equal(choices[0]?.title, "Gloomhaven");
  assert.equal(choices[0]?.continuablePlay?.playId, "play-gloomhaven");
});

test("a voted continuation keeps its exact play_id in the Table picker", () => {
  const choices = buildTableSessionGameChoices({
    votes: [],
    recommendations: [],
    continuablePlays: [
      {
        gameId: "frostpunk",
        title: "Frostpunk",
        coverUrl: null,
        playId: "older-play",
        stateNote: "Stary zapis",
        playedAt: "2026-07-01T18:00:00.000Z",
        accumulatedMinutes: 90,
      },
      {
        gameId: "frostpunk",
        title: "Frostpunk",
        coverUrl: null,
        playId: "proposed-play",
        stateNote: "Generator naprawiony",
        playedAt: "2026-08-01T18:00:00.000Z",
        accumulatedMinutes: 180,
      },
    ],
    continuationVotes: [
      {
        gameId: "frostpunk",
        title: "Frostpunk",
        coverUrl: null,
        playId: "proposed-play",
        stateNote: "Generator naprawiony",
        playedAt: "2026-08-01T18:00:00.000Z",
        accumulatedMinutes: 180,
        yesCount: 3,
      },
    ],
  });

  const proposal = choices.find(
    (choice) => choice.choiceKey === "continuation:proposed-play",
  );
  assert.equal(proposal?.badge, "3 chce dokończyć");
  assert.equal(proposal?.isContinuationProposal, true);
  assert.deepEqual(
    proposal?.continuablePlays.map((play) => play.playId),
    ["proposed-play"],
  );
  assert.equal(
    choices.filter((choice) =>
      choice.continuablePlays.some(
        (play) => play.playId === "proposed-play",
      ),
    ).length,
    1,
  );
});

test("with no votes at all the whole shelf is still reachable", () => {
  const choices = buildTableSessionGameChoices({
    votes: [],
    recommendations: [],
    otherGames: [
      { gameId: "scout", title: "Scout", coverUrl: null },
      { gameId: "heat", title: "Heat", coverUrl: null },
    ],
  });

  assert.deepEqual(
    choices.map((choice) => choice.gameId),
    ["scout", "heat"],
  );
  assert.equal(
    choices.some((choice) => choice.isLeading),
    false,
  );
});
