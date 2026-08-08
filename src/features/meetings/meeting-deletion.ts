/*
 * Spotkanie będące częścią historii partii jest nieusuwalne — w dwóch
 * wariantach, bo dwie różne krawędzie łączą je z Kroniką:
 *   * "start"        — na tym spotkaniu zapisano partię (plays.meeting_id),
 *   * "continuation" — na tym spotkaniu wracano do partii rozpoczętej gdzie
 *                      indziej (meetings.continued_play_id).
 * Oba komunikaty muszą być dokładnie tymi, które rzuca RPC delete_meeting
 * (migracja 20260808120000) — mapMeetingDeleteError rozpoznaje je po wspólnym
 * fragmencie i przepuszcza treść z bazy bez tłumaczenia.
 */
export const MEETING_WITH_CHRONICLE_DELETE_ERROR =
  "To spotkanie jest częścią historii partii w Kronice. Najpierw usuń zapisaną na nim partię.";

export const MEETING_CONTINUATION_DELETE_ERROR =
  "To spotkanie jest częścią historii partii w Kronice. Najpierw usuń powiązanie z kontynuowaną partią w edycji spotkania.";

const CHRONICLE_HISTORY_MARKER = "jest częścią historii partii w Kronice";

export type MeetingChronicleLock = "start" | "continuation";

export function getMeetingChronicleLockMessage(lock: MeetingChronicleLock) {
  return lock === "start"
    ? MEETING_WITH_CHRONICLE_DELETE_ERROR
    : MEETING_CONTINUATION_DELETE_ERROR;
}

type MeetingDeleteErrorLike = {
  code?: string | null;
  message?: string | null;
};

export function mapMeetingDeleteError(error: MeetingDeleteErrorLike) {
  // Treść z bazy jest już komunikatem dla użytkownika i mówi dokładnie, którą
  // krawędź trzeba zdjąć — przepisywanie jej tutaj rozjechałoby oba warianty.
  if (error.message?.includes(CHRONICLE_HISTORY_MARKER)) {
    return error.message;
  }

  if (error.code === "42501") {
    return "Nie masz uprawnień do usunięcia tego spotkania.";
  }

  return "Nie udało się usunąć spotkania. Spróbuj ponownie.";
}
