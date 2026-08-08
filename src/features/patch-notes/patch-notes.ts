export type PatchNotesCategory = {
  category: string;
  items: readonly string[];
};

export type PatchNotesRelease = {
  date: string;
  title: string;
  version?: string;
  categories: readonly PatchNotesCategory[];
};

/**
 * Ręcznie redagowany changelog użytkowy. Historia git jest źródłem wpisów,
 * ale treść pozostaje celowo produktowa i wolna od szczegółów technicznych.
 */
export const PATCH_NOTES: readonly PatchNotesRelease[] = [
  {
    date: "8 sierpnia 2026",
    title: "Jeszcze lepsze spotkania",
    categories: [
      {
        category: "Kalendarium",
        items: [
          "Dodano inteligentne podpowiedzi gier dopasowanych do uczestników spotkania.",
          "Trwające spotkanie jest teraz wyróżnione na Stole komunikatem „GRAMY!”.",
          "Poprawiono tworzenie spotkań i czytelność ich szczegółów na mniejszych ekranach.",
        ],
      },
      {
        category: "Półka",
        items: [
          "Dodano wypożyczanie gier między graczami wraz z informacją, u kogo aktualnie znajduje się egzemplarz.",
          "Opinie o grze pokazują teraz również oceny dodane bez komentarza.",
        ],
      },
      {
        category: "Usprawnienia",
        items: [
          "Odchudzono grafiki aplikacji bez zmiany ich wyglądu, dzięki czemu widoki ładują się sprawniej.",
        ],
      },
    ],
  },
  {
    date: "5–6 sierpnia 2026",
    title: "Nowa oprawa klubowej przygody",
    categories: [
      {
        category: "Kronika",
        items: [
          "Odświeżono karty rozegranych partii i ich układ na telefonach oraz komputerach.",
          "Wyniki i uczestnicy partii są teraz czytelniejsi na każdym ekranie.",
        ],
      },
      {
        category: "Nawigacja",
        items: [
          "Przebudowano menu mobilne i boczne, dodając klimatyczne emblematy aktywnych klas.",
        ],
      },
    ],
  },
  {
    date: "30 lipca – 1 sierpnia 2026",
    title: "Drużyna zawsze na bieżąco",
    categories: [
      {
        category: "Powiadomienia",
        items: [
          "Dodano powiadomienia push dla ważnych wydarzeń i akcji przy wspólnym stole.",
          "Poprawiono niezawodność dostarczania komunikatów.",
        ],
      },
      {
        category: "Kalendarium",
        items: [
          "Rozdzielono proponowanie gier od odpowiedzi graczy, dzięki czemu wybór tytułu jest bardziej przejrzysty.",
        ],
      },
      {
        category: "Stół i Kronika",
        items: [
          "Uspójniono przyciski akcji, rankingi oraz oznaczenia miejsc w Kronice.",
        ],
      },
    ],
  },
  {
    date: "26–29 lipca 2026",
    title: "Pierwsze łupy po premierze",
    categories: [
      {
        category: "Aplikacja",
        items: [
          "Twoja Tura! może być instalowana na telefonie jak zwykła aplikacja.",
          "Dodano możliwość wysyłania pomysłów i zgłaszania poprawek bezpośrednio ze Stołu.",
        ],
      },
      {
        category: "Kronika",
        items: [
          "Dodano pełną obsługę zwycięstw i porażek w grach kooperacyjnych.",
        ],
      },
      {
        category: "Kalendarium",
        items: [
          "Spotkania powiązane z wpisem w Kronice są lepiej chronione przed przypadkowym usunięciem.",
        ],
      },
    ],
  },
];
