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
    date: "17 sierpnia 2026",
    title: "Wielki buff oprawy Stołu",
    categories: [
      {
        category: "Stół",
        items: [
          "Zlecenia i Misje dostały nowe, pergaminowe karty — emblemat rzadkości po lewej, a nagroda w Renomie albo Tukatach wyraźnie odcięta po prawej.",
          "„Legendy przy Stole” to teraz prawdziwa tablica rankingowa: ciemna płyta w złoto-miedzianej ramie, puchary za miejsca i czytelne wyniki.",
          "Kafle „Najbliższe spotkanie” i „Legendy przy Stole” zostały zestawione w równą parę — ta sama wysokość, szerokość i wspólna linia nagłówków.",
          "Przyciski „Zorganizuj spotkanie” i „Zobacz ranking” mają jednakowy rozmiar i plakietki spójne z resztą Stołu.",
          "Sekcja „Świeże wpisy z Kroniki” siedzi teraz na tej samej pergaminowej karcie, co wpisy w samej Kronice.",
          "Uporządkowano nagłówki na telefonie — „Zlecenia” są wyśrodkowane i zestrojone z powitaniem przy Stole.",
          "W podsumowaniu wieczoru „Wznów partię” i „Wybierz kolejną grę” mają wreszcie równą wysokość.",
        ],
      },
    ],
  },
  {
    date: "15 sierpnia 2026",
    title: "Zlecenia w kolorach rzadkości",
    categories: [
      {
        category: "Stół",
        items: [
          "Karty Zleceń mają własne ramy i akcenty zależne od rzadkości — od zwykłych po legendarne.",
          "Poświata karty podkreśla najpilniejsze zadanie, a nagroda za Zlecenie jest widoczna od pierwszego spojrzenia.",
        ],
      },
    ],
  },
  {
    date: "14 sierpnia 2026",
    title: "Odznaki nabijają się same",
    categories: [
      {
        category: "Legendarium",
        items: [
          "Kolejna paczka osiągnięć przyznaje się automatycznie — m.in. Hot Streak, Glass Cannon, Git Gud, Redemption Arc, Hot Take i Candlekeep Sage.",
          "Każde z tych osiągnięć ma teraz jasno opisany warunek zdobycia.",
          "Doszły paski postępu dla odznak zależnych od serii zwycięstw i cięższych gier, a zdobyta odznaka pokazuje pełny, ukończony pasek.",
          "Osiągnięcia oparte na niepewnych danych o grach zostały oznaczone jako planowane — żeby nie obiecywać czegoś, czego system nie umie jeszcze policzyć.",
        ],
      },
      {
        category: "Stół",
        items: [
          "Dopracowano przyciski akcji na telefonie — równiejsze odstępy i czytelniejsze etykiety.",
        ],
      },
    ],
  },
  {
    date: "13 sierpnia 2026",
    title: "Porządek w podsumowaniu wieczoru",
    categories: [
      {
        category: "Stół",
        items: [
          "W podsumowaniu wieczoru lista wyboru kolejnej gry zajmuje teraz pełną szerokość ekranu, a „Zagraj ponownie” przenosi się nad nią — koniec z ciasnym ściśnięciem obu obok siebie.",
        ],
      },
    ],
  },
  {
    date: "12 sierpnia 2026",
    title: "Solidny buff do szybkości",
    categories: [
      {
        category: "Wydajność",
        items: [
          "Przechodzenie między głównymi sekcjami jest teraz znacznie szybsze, szczególnie na telefonach.",
          "Odchudzono ciężkie tła, tekstury i grafiki oraz usprawniono ładowanie okładek gier i pozostałych obrazów.",
          "Dane są pobierane sprawniej i bez zbędnego oczekiwania między kolejnymi krokami.",
          "Backend działa teraz bliżej europejskiej bazy danych, dzięki czemu Stół, Legendarium i Kronika otrzymały szczególnie mocne przyspieszenie.",
        ],
      },
    ],
  },
  {
    date: "11 sierpnia 2026",
    title: "Renoma, Zlecenia i Legendarium",
    categories: [
      {
        category: "Renoma",
        items: [
          "Renoma jest teraz trwałym prestiżem gracza — nie wydajesz jej w Sklepie.",
          "Uporządkowano nagrody za codzienną aktywność i poprawiono progi Renomy za rozbudowę Półki.",
          "Za ukończoną partię Renomę otrzymuje każdy uczestnik, a organizator spotkania dopiero wtedy, gdy spotkanie faktycznie się odbyło.",
          "Historyczne salda Renomy zostały przeliczone według nowych zasad.",
        ],
      },
      {
        category: "Stół i Legendarium",
        items: [
          "Sekcja „Do zrobienia” nosi teraz nazwę „Zlecenia” — to krótkie działania organizacyjne, a nie Misje gameplayowe.",
          "Administratorzy mogą zdobywać Renomę i osiągnięcia, ale ich konto nie pojawia się w publicznym rankingu Legendarium.",
          "Ukryte i obserwujące konta pozostają poza grywalizacją.",
        ],
      },
    ],
  },
  {
    date: "9 sierpnia 2026",
    title: "Nowa oprawa Karty Gracza",
    categories: [
      {
        category: "Profil",
        items: [
          "Dodano Ekwipunek ramek portretu oraz wybór aktywnej ramki Karty Gracza.",
          "Wybrana ramka jest teraz widoczna również w Legendarium, na Półce i w nawigacji.",
          "Sklep z ramkami prezentuje nadchodzące oprawy Rare i Epic — możliwość ich zdobywania pojawi się wraz z nową walutą.",
        ],
      },
    ],
  },
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
