-- Misje v1 — PRODUKCYJNY PODGLĄD, WYŁĄCZNIE DO ODCZYTU.
--
-- Kiedy uruchamiać: PO wdrożeniu migracji 20260824120000_missions_v1.sql
-- (która celowo nie generuje żadnych Misji), a PRZED świadomym APPLY.
--
-- Cała transakcja jest wymuszona jako read-only, więc nawet pomyłka w treści
-- zapytania nie może niczego zapisać. Nie usuwaj tej linii.
begin read only;

-- ---------------------------------------------------------------------------
-- 0. Czy schemat w ogóle jest wdrożony
-- ---------------------------------------------------------------------------

select
  to_regclass('public.user_missions') is not null as has_user_missions,
  to_regclass('public.tukat_events') is not null as has_tukat_ledger,
  to_regclass('public.tukat_balances') is not null as has_balance_view,
  exists (
    select 1
    from pg_catalog.pg_proc as routine
    join pg_catalog.pg_namespace as schema_name
      on schema_name.oid = routine.pronamespace
    where schema_name.nspname = 'private'
      and routine.proname = 'recompute_play_rewards_before_missions_v1'
  ) as recompute_chain_installed;

-- ---------------------------------------------------------------------------
-- 1. Stan wyjściowy — powinien być pusty
-- ---------------------------------------------------------------------------
--
-- Migracja nie generuje Misji ani nie wypłaca Tukatów. Jeśli te liczby nie są
-- zerowe przed pierwszym APPLY, coś już uruchomiło silnik — zatrzymaj się i
-- ustal co, zanim pójdziesz dalej.

select
  (select count(*) from public.user_missions) as missions_total,
  (select count(*) from public.user_missions where status = 'active') as missions_active,
  (select count(*) from public.tukat_events) as tukat_events_total,
  (select coalesce(sum(amount), 0) from public.tukat_events) as tukats_paid;

-- ---------------------------------------------------------------------------
-- 2. Renoma NIE MOŻE być tknięta
-- ---------------------------------------------------------------------------
--
-- Misje mają własny ledger. Zero jest tu jedyną poprawną odpowiedzią — i przed,
-- i po APPLY.

select
  count(*) as renown_events_mentioning_missions
from public.point_events
where action_type ilike '%mission%'
   or related_entity_type = 'mission';

-- ---------------------------------------------------------------------------
-- 3. WŁAŚCIWY PODGLĄD — co wygenerowałby operatorski APPLY
-- ---------------------------------------------------------------------------
--
-- WYMAGA SESJI ADMINISTRATORA. RPC sprawdza private.is_admin(), a edytor SQL i
-- psql łączą się bez JWT — bez poniższych dwóch linii sekcje 3–5 skończą się
-- błędem 42501. Podstaw UUID swojego konta administratora z public.app_members
-- (role = 'admin'). Oba ustawienia są transakcyjne i znikają razem z ROLLBACK.
--
--   select set_config(
--     'request.jwt.claims',
--     '{"sub":"<UUID-ADMINA>","role":"authenticated"}',
--     true
--   );
--   set local role authenticated;
--
-- Kolumny odpowiadają wprost na pytania z checklisty wdrożeniowej:
--
--   user / mission_type / game_title      — kto, co, na którą grę,
--   trigger_reason                        — DLACZEGO ta gra jest kandydatem,
--   proposed_generated_at / _expires_at   — termin Misji,
--   reward_tukats                         — nagroda w Tukatach,
--   priority + rank_in_type               — miejsce w kolejce,
--   decision + skip_reason                — dlaczego kandydat wygrał albo
--                                           przegrał z innym.
--
-- Funkcja jest STABLE i nie wykonuje żadnego zapisu.

select
  display_name,
  mission_type,
  game_title,
  trigger_reason,
  proposed_generated_at,
  proposed_expires_at,
  reward_tukats,
  priority,
  rank_in_type,
  decision,
  skip_reason
from public.preview_mission_generation()
order by display_name, priority, rank_in_type;

-- ---------------------------------------------------------------------------
-- 4. Podsumowanie zbiorcze — ile Misji i ile Tukatów wchodzi w obieg
-- ---------------------------------------------------------------------------

select
  preview.mission_type,
  count(*) filter (where preview.decision = 'generate') as would_generate,
  count(*) filter (where preview.decision = 'skip') as would_skip,
  coalesce(
    sum(preview.reward_tukats) filter (where preview.decision = 'generate'),
    0
  ) as tukats_at_stake
from public.preview_mission_generation() as preview
group by preview.mission_type
order by preview.mission_type;

select
  count(distinct preview.user_id) filter (
    where preview.decision = 'generate'
  ) as players_receiving_missions,
  count(*) filter (where preview.decision = 'generate') as missions_to_create
from public.preview_mission_generation() as preview;

-- ---------------------------------------------------------------------------
-- 5. Kontrola limitów — nikt nie może wyjść ponad dwie Misje
-- ---------------------------------------------------------------------------
--
-- Oczekiwany wynik: pusto. Każdy wiersz oznacza błąd w symulacji, a nie
-- dopuszczalny wyjątek — zatrzymaj wdrożenie.

select
  preview.user_id,
  preview.display_name,
  count(*) as planned_missions
from public.preview_mission_generation() as preview
where preview.decision = 'generate'
group by preview.user_id, preview.display_name
having count(*) > 2;

-- ---------------------------------------------------------------------------
-- 6. Kontrola nakładania się typów na tej samej grze
-- ---------------------------------------------------------------------------
--
-- Ta sama gra bywa jednocześnie kandydatem na Rewanż i na Dokończ Historię.
-- Do wygenerowania może wejść tylko jedna z nich — inaczej jeden wieczór przy
-- jednym tytule zamknąłby dwie Misje i wypłacił podwójnie.
--
-- Oczekiwany wynik: pusto. Każdy wiersz oznacza błąd — zatrzymaj wdrożenie.

select
  preview.user_id,
  preview.display_name,
  preview.game_title,
  count(*) as planned_missions_for_game
from public.preview_mission_generation() as preview
where preview.decision = 'generate'
  and preview.game_id is not null
group by preview.user_id, preview.display_name, preview.game_title
having count(*) > 1;

-- ---------------------------------------------------------------------------
-- 7. Pokrycie klasyfikacji dodatków — warunek wstępny Pierwszego Rozdziału
-- ---------------------------------------------------------------------------
--
-- Od migracji 20260825120000 Misja „Pierwszy Rozdział” wymaga
-- games.is_expansion = false. Pozycja nierozstrzygnięta (null) NIE generuje
-- Misji — to celowy fail-safe, żeby dodatek bez klasyfikacji nie trafił na
-- Stół jako „rozegraj swoją pierwszą partię”.
--
-- Dopóki `nierozstrzygniete_pilne` nie spadnie do zera, podgląd wyżej pokaże
-- mniej Pierwszych Rozdziałów, niż finalnie powstanie. Backfill:
-- scripts/backfill-expansion-classification.mts (podgląd, zero zapisów), a
-- potem scripts/apply-expansion-classification.mts z zaakceptowanym plikiem.

select
  count(*) as gry_aktywne,
  count(*) filter (where game.is_expansion = false) as sklasyfikowane_samodzielne,
  count(*) filter (where game.is_expansion = true) as sklasyfikowane_dodatki,
  count(*) filter (where game.is_expansion is null) as nierozstrzygniete,
  count(*) filter (
    where game.is_expansion is null
      and not exists (
        select 1
        from public.play_participants as participant
        join public.plays as play on play.id = participant.play_id
        where participant.user_id = game.owner_id
          and play.game_id = game.id
          and play.status = 'completed'
      )
  ) as nierozstrzygniete_pilne
from public.games as game
where game.archived_at is null;

-- Kontrola szczelności: żaden dodatek ani pozycja nierozstrzygnięta nie może
-- pojawić się w podglądzie jako Pierwszy Rozdział. Oczekiwany wynik: pusto.

select
  preview.display_name,
  preview.game_title,
  game.is_expansion
from public.preview_mission_generation() as preview
join public.games as game on game.id = preview.game_id
where preview.mission_type = 'first_chapter'
  and game.is_expansion is distinct from false;

reset role;

rollback;

-- ===========================================================================
-- APPLY — ODDZIELNY, ŚWIADOMY KROK
-- ===========================================================================
--
-- Uruchamiać DOPIERO po ręcznej akceptacji powyższego podglądu, jako osobne
-- polecenie i w osobnej sesji:
--
--   select * from private.apply_mission_generation();
--
-- Zwraca (expired_count, completed_count, generated_count). Operacja jest
-- idempotentna — powtórzenie nie tworzy drugiej tej samej Misji ani nie płaci
-- drugi raz. Po APPLY warto powtórzyć sekcje 1–2 tego pliku: liczba Misji
-- powinna zgadzać się z podglądem, a `renown_events_mentioning_missions`
-- pozostać zerem.
