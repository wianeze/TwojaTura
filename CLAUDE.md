# CLAUDE.md

Instrukcje dla agentów AI (Claude Code i inni) pracujących nad projektem „Twoja Tura!".

## Przegląd projektu

„Twoja Tura!" to prywatna aplikacja webowa dla zamkniętej grupy znajomych grających w gry planszowe — cyfrowe centrum grupy, nie tylko katalog gier. Łączy: wspólną kolekcję gier, organizację spotkań, historię rozgrywek, oceny graczy oraz system grywalizacji (punkty, ranking, osiągnięcia, klasy postaci).

Pięć głównych obszarów aplikacji (routing i UI):

- **Stół** (`/`) — dashboard, bieżąca aktywność, questy
- **Półka** (`/gry`) — wspólna kolekcja gier
- **Kalendarium** (`/kalendarium`) — organizacja spotkań
- **Kronika** (`/kronika`) — historia rozgrywek
- **Legendarium** (`/legendarium`) — ranking, osiągnięcia, klasy postaci

**Podział odpowiedzialności**: właściciel projektu odpowiada za wizję produktu, funkcje, UX, mechaniki grywalizacji i priorytety. Rola agenta to wsparcie techniczne zgodne z istniejącą architekturą i decyzjami produktowymi — nie podejmuj samodzielnie decyzji produktowych/UX/balansu grywalizacji.

## Sposób pracy nad zadaniem

- Przed rozpoczęciem każdej pracy sprawdź `git status` i `git diff`.
- Najpierw przeanalizuj istniejące rozwiązanie i wskaż pliki związane z zadaniem.
- Przed większą zmianą przedstaw plan i poczekaj na akceptację.
- Wykonuj najmniejszą możliwą zmianę realizującą wymaganie.
- Nie zmieniaj plików niezwiązanych z zadaniem.
- Nie cofaj, nie nadpisuj i nie porządkuj zmian użytkownika lub innego agenta.
- Po zmianach uruchom odpowiednie lintowanie, typecheck, testy lub build.
- Na końcu pokaż podsumowanie, wyniki weryfikacji, `git status` oraz `git diff`.
- Nie wykonuj commita ani `git push`, chyba że użytkownik wyraźnie o to poprosi.
- Polecenia destrukcyjne dla lokalnej bazy danych — w szczególności `db:reset`, uruchamianie migracji, reset fixture'ów QA i wszelkie czyszczenie danych — wymagają wcześniejszego poinformowania użytkownika i jego zgody, nawet lokalnie.

## Stos technologiczny

Źródłem prawdy jest zawsze `package.json` — nie duplikuj tu wersji, bo się zdezaktualizują. Stan na dziś: Next.js 16 (App Router, `proxy.ts` zamiast `middleware.ts`), React 19, TypeScript `strict`, Tailwind CSS 4 (bez `tailwind.config.*` — konfiguracja przez `@tailwindcss/postcss`), Supabase (`@supabase/ssr` + `@supabase/supabase-js`, bez starszego `auth-helpers-nextjs`), ESLint 9 (flat config) + Prettier, pnpm. Supabase CLI uruchamiane przez `pnpm dlx supabase@<wersja>` (nie jest zależnością projektu).

Brak frameworka testowego typu Jest/Vitest — testy jednostkowe przez natywny `node --test` (`tests/unit/*.test.ts`), testy bazy danych przez pgTAP (`supabase/tests/database/`).

## Struktura repozytorium

- `src/app/` — Next.js App Router
  - `(app)/` — trasy chronione (wymagają aktywnego członkostwa)
  - `(auth)/` — trasy publiczne: logowanie, ustaw-haslo, brak-dostepu
  - `auth/callback/route.ts` — Route Handler PKCE/OTP dla Supabase Auth
- `src/proxy.ts` + `src/lib/supabase/proxy.ts` — odpowiednik middleware (konwencja Next 16)
- `src/features/{auth,dashboard,games,legendarium,meetings,plays,ratings}/`
  - `queries.ts` — odczyt danych (wywoływane z Server Components)
  - `actions.ts` — zapis danych (Server Actions, `"use server"`)
- `src/components/{layout,ui}/` — własny system designu (bez shadcn/Radix), motyw „drewniano-kominkowy"
- `src/lib/supabase/{client,server,proxy,env}.ts` — 3 oddzielne fabryki klienta Supabase
- `src/types/database.generated.ts` — wygenerowane typy (`pnpm db:types`) — NIE edytować ręcznie
- `supabase/migrations/` — migracje SQL, chronologicznie ponumerowane
- `supabase/tests/database/` — testy pgTAP (RLS, punkty, osiągnięcia, klasy)
- `scripts/` — skrypty operatorskie (invite-user) i fixture'y QA
- `docs/qa-*.md` — dokumentacja fixture'ów QA (achievements/badges/classes)

**Wzorzec modułu domenowego**: każdy folder w `src/features/` trzyma razem `queries.ts` (odczyt) i `actions.ts` (zapis) dla danego obszaru — trzymaj się tego wzorca przy nowych funkcjach zamiast wprowadzać nowe abstrakcje.

## Konwencje przepływu danych

- Odczyt danych dzieje się w **async Server Components**, wołających funkcje z `queries.ts` danego modułu (serwerowy klient Supabase z `src/lib/supabase/server.ts`).
- Zapis danych przez **Next.js Server Actions** (`"use server"` w `actions.ts`), wołane z formularzy klienckich przez `useActionState`, kończące się `revalidatePath`/`redirect`.
- **Świadomie brak React Query/SWR** — to decyzja architektoniczna, nie luka do naprawienia.
- Po mutacjach związanych z grywalizacją, akcje wołają sekwencyjnie odpowiednie RPC punktowe/achievementowe (patrz niżej) — zachowuj tę kolejność przy dodawaniu nowych typów zdarzeń.

## Warstwa Supabase — trzy klienty

- `src/lib/supabase/client.ts` — klient przeglądarkowy (Client Components).
- `src/lib/supabase/server.ts` — klient serwerowy dla Server Components/Actions (cookies przez `next/headers`).
- `src/lib/supabase/proxy.ts` — klient używany wyłącznie w `updateSession` (odpowiednik middleware), operujący na `request`/`NextResponse`.

Nie twórz czwartego wariantu klienta — użyj właściwego z powyższych zależnie od kontekstu wykonania.

## Auth i RLS

- Rejestracja jest wyłączona (`enable_signup: false` w `supabase/config.toml`) — dostęp wyłącznie przez zaproszenie (`pnpm invite:user`, trigger na `auth.users` tworzy `profile` + `app_members`).
- **Trzywarstwowa ochrona tras**: (1) `src/proxy.ts` — globalny redirect niezalogowanych/nieaktywnych; (2) `src/app/(app)/layout.tsx` — serwerowy guard przez `getCurrentMember()`; (3) pojedyncze strony dodatkowo weryfikują status. Nowe trasy chronione dodawaj wewnątrz grupy `(app)`, nie twórz równoległego mechanizmu ochrony.
- RLS jest włączone na **wszystkich** tabelach domenowych, wg wzorca helperów `private.is_active_member()` / `private.is_admin()` (SQL, `security definer`). Nowe tabele muszą dostać RLS + politykę w tym samym stylu — migracja `supabase/migrations/20260704000700_row_level_security.sql` to dobry punkt odniesienia dla stylu polityk, ale **nie jedyne źródło prawdy**: sprawdź też późniejsze migracje (np. dotyczące `game_expansions`, `achievement_definitions`, `user_achievements`, `class_definitions`), które mogły doprecyzować lub rozszerzyć wzorzec.
- **Zasada krytyczna**: punkty (`point_events`) i osiągnięcia (`user_achievements`) nigdy nie są wstawiane bezpośrednio przez klienta — wyłącznie przez funkcje `security definer` (RPC). Nie dodawaj polityk INSERT dla zwykłych użytkowników na tych tabelach.

## System punktów, osiągnięć i klas

Główna logika naliczania punktów, przyznawania osiągnięć i weryfikacji klas znajduje się w PostgreSQL i funkcjach RPC (schemat `private`/`public`, `security definer`). Warstwa `src/features/*/[shelf|rating|meeting|play]-points.ts` i `src/features/legendarium/achievement-awards.ts` wywołuje te RPC po udanej mutacji i normalizuje odpowiedź; część logiki prezentacyjnej (np. paski postępu w `achievement-progress.ts`) istnieje też po stronie TypeScript. Przy dodawaniu nowej reguły naliczania punktów lub przyznawania odznak trzymaj się tego podziału: reguła/warunek w migracji SQL, cienki wrapper TS wołający RPC po odpowiedniej akcji.

- Cennik punktów: `private.point_reward_for(action_type)` — stały, zaszyty w SQL.
- Osiągnięcia, klasy i ich wymagania: liczba zdefiniowanych osiągnięć, „prostych" automatycznych warunków, klas postaci i wymagań na klasę **zmienia się w czasie** — stan z dnia audytu (2026-07-23) to odpowiednio ok. 51 osiągnięć, 13 prostych warunków automatycznych, 14 klas po 5 wymagań każda. **Nie traktuj tych liczb jako trwałej zasady** — zawsze zweryfikuj aktualny stan w `achievement_definitions`, `class_definitions`, `class_requirements` i najnowszych migracjach przed podjęciem decyzji opartej na tych wartościach.
- Wybór klasy postaci jest zawsze manualny przez RPC `set_active_class` (wymaga spełnienia wszystkich wymagań danej klasy) — brak automatycznego przydziału, zweryfikuj to zachowanie w aktualnym kodzie SQL, jeśli ma to znaczenie dla zadania.
- Questy na dashboardzie (`src/features/dashboard/quests.ts`) to front-endowa warstwa UI (podpowiedzi odzwierciedlające cennik) — nie mają tabeli w bazie i nie przyznają punktów same.
- Faktyczna specyfikacja reguł (idempotencja, warunki brzegowe jak remisy/kooperacja) żyje w testach pgTAP: `supabase/tests/database/001_security_and_rls.test.sql`.

## Migracje i testy bazy danych

- Migracje w `supabase/migrations/`, nazwane `YYYYMMDDHHMMSS_opis.sql`, aplikowane chronologicznie.
- `pnpm db:verify` = `db:reset` + `db:test` (pgTAP) + `db:types` (regeneracja `database.generated.ts`). Po każdej zmianie schematu, po wcześniejszym poinformowaniu użytkownika i uzyskaniu jego zgody, uruchom `pnpm db:verify`.
- **Nigdy nie łącz się z produkcyjnym Supabase** i nie wykonuj migracji ani żadnych poleceń destrukcyjnych dla lokalnej bazy (`db:reset`, reset fixture'ów QA, czyszczenie danych) bez wcześniejszego poinformowania użytkownika i jego zgody — nawet lokalnie. Skrypty QA mają dodatkowo twardą blokadę `assertQaEnvironment` przeciw produkcji/zdalnemu Supabase.

## Polecenia deweloperskie

| Polecenie                                                             | Cel                                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm dev` / `build` / `start`                                        | uruchomienie aplikacji Next.js                                                 |
| `pnpm lint` / `typecheck` / `format:check` / `check`                  | jakość kodu (`check` = wszystkie trzy)                                         |
| `pnpm test`                                                           | testy jednostkowe (`node --test`)                                              |
| `pnpm supabase:start/status/stop`                                     | lokalny Supabase (Docker)                                                      |
| `pnpm db:migrate` / `db:reset` / `db:test` / `db:types` / `db:verify` | cykl migracji i typów (destrukcyjne — patrz zasady wyżej)                      |
| `pnpm invite:user -- --email ... --name ...`                          | zaproszenie nowego użytkownika (operator)                                      |
| `pnpm qa:achievements/classes/badges[:reset\|:check]`                 | fixture'y QA do lokalnego testowania grywalizacji (reset — patrz zasady wyżej) |

## Zasady dla agentów

- Nie łącz się z produkcyjnym Supabase, nie wykonuj deployu na Vercel, nie twórz commitów/push bez wyraźnej prośby użytkownika.
- Nie czytaj plików `.env*` (poza `.env.example`) ani żadnych sekretów/kluczy.
- Nie podejmuj decyzji produktowych, UX-owych ani dotyczących balansu grywalizacji (punkty, wymagania klas, rzadkość osiągnięć) — to wyłączna kompetencja właściciela projektu.
- Nie zastępuj istniejącego wzorca (`queries.ts`/`actions.ts`, logika grywalizacji w SQL) nową abstrakcją bez wyraźnej potrzeby.
- Kontekst QA/fixture'ów: `docs/qa-achievements.md`, `docs/qa-badges.md`, `docs/qa-classes.md`.

## Stan dokumentacji

Wg audytu z 2026-07-23: sekcja „Aktualny stan" w `README.md` opisuje jako gotowe wyłącznie domeny `games`/`ratings` i nie wspomina o Legendarium/osiągnięciach/klasach, mimo że te funkcje są już rozbudowane w kodzie i bazie. To obserwacja o stanie dokumentacji, nie instrukcja techniczna — README może wymagać aktualizacji, ale decyzję o tym podejmuje właściciel projektu.

Zawartość `tests/e2e/`, `outputs/etap2-preflight.md` i `supabase/snippets/` nie została w pełni zweryfikowana w ramach audytu — status tych plików (robocze vs. trwałe) pozostaje do potwierdzenia.
