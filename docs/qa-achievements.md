# QA odznak i klas (wyłącznie lokalnie)

Narzędzie przygotowuje oznaczone fixture’y `qa-achievements-*` w lokalnym Supabase, bez klikania interfejsu i bez używania go przez aplikację. Nie istnieje dla niego strona ani link w produkcji.

## Uruchomienie

1. Uruchom lokalne Supabase: `pnpm supabase:start`.
2. Przygotuj dane: `pnpm qa:achievements`.
3. Sprawdź fixture’y automatycznie: `pnpm qa:achievements:check`.
4. Zaloguj się jednym z kont poniżej, aby wykonać odbiór wizualny.

Wspólne hasło wszystkich kont: `QaAchievements123!`.

| Konto                                           | Co sprawdzić                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `qa-achievements-near@twojatura.local`          | Progi 49/50, 9/10, 4/5, 19/20, 4/5 Gospodarza Obozu i seria 2/3.                                                         |
| `qa-achievements-ready@twojatura.local`         | Pełne progi, Naturalna Jedynka 3/3, Mroczna Żądza 3/3, Gospodarz Obozu 5/5 oraz odznaki 0/1.                             |
| `qa-achievements-last-one@twojatura.local`      | Naturalna Jedynka 1/3.                                                                                                   |
| `qa-achievements-last-two@twojatura.local`      | Naturalna Jedynka 2/3.                                                                                                   |
| `qa-achievements-coop@twojatura.local`          | Trzy partie w trybie kooperacyjnym z wynikiem drużyny „wygrana" (bez miejsc): Naturalna Jedynka 0/3 i Mroczna Żądza 3/3. |
| `qa-achievements-loot-near@twojatura.local`     | Loot Goblin 24/25.                                                                                                       |
| `qa-achievements-streak-broken@twojatura.local` | Przerwana seria zwycięstw — bez Mrocznej Żądzy.                                                                          |
| `qa-achievements-class-locked@twojatura.local`  | Bard Stołu 4/5.                                                                                                          |
| `qa-achievements-class-ready@twojatura.local`   | Bard Stołu 5/5 oraz aktywna klasa.                                                                                       |

## Automatyczny check

`pnpm qa:achievements:check` nie zmienia danych. Odczytuje przygotowane fixture’y i wypisuje tabelę `PASS/FAIL` z oczekiwanym i faktycznym wynikiem. Kod wyjścia wynosi `1`, jeśli choć jedno sprawdzenie się nie zgadza.

Jeśli poprzednie przygotowanie danych zostało przerwane, checker kończy się czytelnym komunikatem `Fixture’y nieprzygotowane, uruchom pnpm qa:achievements` zamiast raportować niepełny seed jako błędy reguł odznak. Skrypt oznacza fixture’y jako gotowe dopiero po zapisaniu danych i pomyślnym wykonaniu automatyzacji.

Bez klikania sprawdzane są:

- Naturalna Jedynka 1/3, 2/3 i 3/3,
- brak progresu Naturalnej Jedynki dla partii kooperacyjnych (nie mają miejsc, więc nie istnieje w nich „ostatnie miejsce"),
- Mroczna Żądza po trzech kooperacyjnych zwycięstwach drużyny,
- Gospodarz Obozu 4/5 i 5/5,
- klasa Bard Stołu 4/5 i 5/5,
- ustawiona aktywna klasa,
- podstawowe ukrywanie sekretów i oznaczenie ręcznych definicji.

W interfejsie nadal trzeba obejrzeć wizualnie karty odznak i klas, ich liczniki, ukrycie treści sekretnej odznaki, brak sztucznego licznika dla odznak ręcznych oraz prezentację aktywnej klasy w Legendarium i profilu.

## Powtórzenie i reset

`pnpm qa:achievements` używa stałych identyfikatorów fixture’ów i uzupełnia te same dane. Po zmianie reguł wynikowych zalecany jest jednak czysty przebieg:

```text
pnpm qa:achievements:reset
pnpm qa:achievements
pnpm qa:achievements:check
```

`pnpm qa:achievements:reset` wykonuje pełny reset **wyłącznie lokalnej** bazy Supabase, a więc usuwa również inne lokalne dane deweloperskie. Reset usuwa też ewentualną Naturalną Jedynkę błędnie naliczoną wcześniej za wynik 1/1/1.

Od wdrożenia silnika przeliczania nagród sytuacja jest inna niż wcześniej: nagrody pochodzące z partii (punkty za zapis, odznaki uczestnikowe) są przeliczane deklaratywnie przy każdej mutacji partii, więc edycja albo usunięcie wpisu potrafi je **cofnąć** — przez zdarzenie kompensujące w księdze punktowej, nie przez usunięcie historii. Poza tym zakresem (odznaki ręczne, odznaki spoza domeny partii, punkty za RSVP/głosy/spotkania/oceny) nic nie jest ruszane. Partie sprzed wdrożenia mają `plays.rewards_managed = false` i nigdy nie dostaną punktów za zapis z mocą wsteczną.

## Bezpieczeństwo

Wszystkie trzy komendy mają twardą blokadę `NODE_ENV=production` i odrzucają adres Supabase inny niż `localhost` lub `127.0.0.1`. Klucz serwera jest odczytywany wyłącznie przez proces lokalnego skryptu z `supabase status`; nie trafia do klienta ani do kodu aplikacji.
