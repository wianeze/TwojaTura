/**
 * Szablony administratora trzymamy w kodzie jako typowaną konfigurację, a nie
 * w bazie: to teksty produktowe, które zmieniają się razem z aplikacją, a nie
 * dane wymagające migracji.
 *
 * Wybranie szablonu WYŁĄCZNIE uzupełnia formularz po stronie klienta — nie
 * wywołuje żadnej akcji serwerowej i niczego nie wysyła. Administrator może
 * potem zmienić tytuł i treść przed potwierdzeniem.
 */
export type PushTemplateKey =
  | "meeting_vote_reminder"
  | "meeting_confirm_reminder"
  | "meeting_today"
  | "complete_meeting"
  | "new_feature"
  | "admin_message";

export type PushTemplate = {
  key: PushTemplateKey;
  label: string;
  title: string;
  body: string;
  /** Formularz pokazuje wtedy wybór spotkania, z którego powstaje action_url. */
  requiresMeeting?: boolean;
  actionUrl?: string;
  hint?: string;
};

export const PUSH_TEMPLATES: readonly PushTemplate[] = [
  {
    key: "admin_message",
    label: "Własna wiadomość",
    title: "",
    body: "",
    hint: "Pusty formularz — napisz powiadomienie od zera.",
  },
  {
    key: "meeting_vote_reminder",
    label: "Przypomnienie o głosowaniu",
    title: "Zagłosuj na gry",
    body: "Nie wszyscy wybrali jeszcze gry na najbliższe spotkanie.",
    requiresMeeting: true,
    hint: "Wskaż spotkanie — link poprowadzi na jego stronę.",
  },
  {
    key: "meeting_confirm_reminder",
    label: "Potwierdzenie spotkania",
    title: "Twoja Tura!",
    body: "Pamiętaj potwierdzić spotkanie",
    requiresMeeting: true,
    hint: "Przypomnienie dla organizatora po dwóch odpowiedziach „Będę”.",
  },
  {
    key: "meeting_today",
    label: "Spotkanie dzisiaj",
    title: "Spotkanie już dziś!",
    body: "Planszówkowy wieczór zaczyna się już dzisiaj.",
    requiresMeeting: true,
    hint: "Możesz wskazać spotkanie, żeby dodać link.",
  },
  {
    key: "complete_meeting",
    label: "Uzupełnienie Kroniki",
    title: "Uzupełnij rozegrane partie",
    body: "Dodaj do Kroniki gry i wyniki ostatniego spotkania.",
    actionUrl: "/kronika/nowa",
  },
  {
    key: "new_feature",
    label: "Nowość w aplikacji",
    title: "Nowość w Twoja Tura!",
    body: "",
    hint: "Treść uzupełnia administrator.",
  },
] as const;

export function findPushTemplate(
  key: string | null | undefined,
): PushTemplate | null {
  if (!key) return null;
  return PUSH_TEMPLATES.find((template) => template.key === key) ?? null;
}
