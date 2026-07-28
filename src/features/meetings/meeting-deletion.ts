export const MEETING_WITH_CHRONICLE_DELETE_ERROR =
  "Nie można usunąć spotkania z zapisaną partią w Kronice.";

type MeetingDeleteErrorLike = {
  code?: string | null;
  message?: string | null;
};

export function mapMeetingDeleteError(error: MeetingDeleteErrorLike) {
  if (error.message?.includes(MEETING_WITH_CHRONICLE_DELETE_ERROR)) {
    return MEETING_WITH_CHRONICLE_DELETE_ERROR;
  }

  if (error.code === "42501") {
    return "Nie masz uprawnień do usunięcia tego spotkania.";
  }

  return "Nie udało się usunąć spotkania. Spróbuj ponownie.";
}
