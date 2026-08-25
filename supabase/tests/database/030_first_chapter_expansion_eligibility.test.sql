begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

-- ===========================================================================
-- Pierwszy Rozdział — wyłącznie gry samodzielne.
--
-- Produkcyjny podgląd zaproponował „Planet Unknown: Supermoon” (dodatek), a
-- pominął „Planet Unknown” (grę bazową). Ten plik pilnuje, żeby to się nie
-- powtórzyło — łącznie z regresją na dokładnie tej parze tytułów.
--
-- Kluczowa asercja to ta o `null`: fail-safe działa tylko wtedy, gdy pozycja
-- NIEROZSTRZYGNIĘTA również wypada z puli. Gdyby ktoś kiedyś zamienił warunek
-- `is_expansion = false` na `is_expansion is not true`, testy 2 i 5 zaświecą się
-- na czerwono.
-- ===========================================================================

delete from public.plays;
update public.games set archived_at = now();

create function pg_temp.log_competitive(
  p_play_id uuid,
  p_game_id uuid,
  p_played_at timestamptz,
  p_winner uuid,
  p_loser uuid
) returns void
language plpgsql
as $$
begin
  insert into public.plays (
    id, game_id, created_by, played_at, status, mode, rewards_managed
  )
  values (
    p_play_id, p_game_id, p_winner, p_played_at, 'completed', 'competitive', true
  );

  insert into public.play_participants (play_id, user_id, placement, is_winner)
  values
    (p_play_id, p_winner, 1, true),
    (p_play_id, p_loser, 2, false);
end;
$$;

create function pg_temp.first_chapter_games(p_user_id uuid)
returns setof uuid
language sql
as $$
  select candidate.game_id
  from private.mission_candidates(p_user_id) as candidate
  where candidate.mission_type = 'first_chapter'::public.mission_type
  order by candidate.game_id;
$$;

-- Półka Marty: gra bazowa, jej dodatek i pozycja jeszcze nieoceniona.
insert into public.games (id, title, owner_id, status, is_expansion) values
  (
    '91000000-0000-4000-8000-000000000001',
    'Planet Unknown',
    '10000000-0000-0000-0000-000000000002',
    'available',
    false
  ),
  (
    '91000000-0000-4000-8000-000000000002',
    'Planet Unknown: Supermoon',
    '10000000-0000-0000-0000-000000000002',
    'available',
    true
  ),
  (
    '91000000-0000-4000-8000-000000000003',
    'QA Pozycja nierozstrzygnięta',
    '10000000-0000-0000-0000-000000000002',
    'available',
    null
  );

-- Dodatki na Półce Michała — do sprawdzenia, że pozostałe trzy typy Misji
-- działają dla nich bez zmian.
insert into public.games (id, title, owner_id, status, is_expansion) values
  (
    '91000000-0000-4000-8000-000000000011',
    'QA Dodatek z rewanżem',
    '10000000-0000-0000-0000-000000000003',
    'available',
    true
  ),
  (
    '91000000-0000-4000-8000-000000000012',
    'QA Dodatek wskrzeszany',
    '10000000-0000-0000-0000-000000000003',
    'available',
    true
  ),
  (
    '91000000-0000-4000-8000-000000000013',
    'QA Dodatek odłożony',
    '10000000-0000-0000-0000-000000000003',
    'available',
    true
  );

-- ===========================================================================
-- KWALIFIKACJA
-- ===========================================================================

select results_eq(
  $$select pg_temp.first_chapter_games('10000000-0000-0000-0000-000000000002')$$,
  $$values ('91000000-0000-4000-8000-000000000001'::uuid)$$,
  '1. Pierwszy Rozdział obejmuje wyłącznie grę samodzielną z Półki'
);

select is(
  (
    select count(*)
    from private.mission_candidates('10000000-0000-0000-0000-000000000002')
      as candidate
    where candidate.mission_type = 'first_chapter'
      and candidate.game_id = '91000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  '2. dodatek (is_expansion = true) nigdy nie jest kandydatem'
);

select is(
  (
    select count(*)
    from private.mission_candidates('10000000-0000-0000-0000-000000000002')
      as candidate
    where candidate.mission_type = 'first_chapter'
      and candidate.game_id = '91000000-0000-4000-8000-000000000003'
  ),
  0::bigint,
  '3. pozycja nierozstrzygnięta (null) też nie jest kandydatem — fail-safe'
);

-- Regresja z produkcyjnego podglądu, dosłownie ta para tytułów.
select private.reconcile_user_missions(
  array['10000000-0000-0000-0000-000000000002'::uuid], null, 'pgtap'
);

select results_eq(
  $$
    select game.title
    from public.user_missions as mission
    join public.games as game on game.id = mission.game_id
    where mission.user_id = '10000000-0000-0000-0000-000000000002'
      and mission.mission_type = 'first_chapter'
      and mission.status = 'active'
  $$,
  $$values ('Planet Unknown'::text)$$,
  '4. generator wybiera Planet Unknown, nigdy Planet Unknown: Supermoon'
);

-- Gdyby fail-safe puścił nierozstrzygnięte, generator wypełniłby drugi slot
-- pozycją '91...0003'. Ta asercja pilnuje, że tego nie robi.
select is(
  (
    select count(*)
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000002'
      and mission_type = 'first_chapter'
      and status = 'active'
  ),
  1::bigint,
  '5. nierozstrzygnięta pozycja nie wypełnia wolnego slotu'
);

-- ===========================================================================
-- BRAK REGRESJI W POZOSTAŁYCH TYPACH
-- ===========================================================================
--
-- Dodatek rozegrany w ramach wieczoru jest normalną partią, więc Rewanż,
-- Wskrzeszenie i Dokończ Historię MUSZĄ go nadal obejmować. Ograniczenie
-- dotyczy wyłącznie Pierwszego Rozdziału, który mówi „zagraj w to po raz
-- pierwszy” — a w dodatek nie da się zagrać samodzielnie.

select pg_temp.log_competitive(
  '91000000-0000-4000-8000-000000000101',
  '91000000-0000-4000-8000-000000000011',
  now() - interval '2 days',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002'
);
select pg_temp.log_competitive(
  '91000000-0000-4000-8000-000000000102',
  '91000000-0000-4000-8000-000000000012',
  now() - interval '200 days',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);
select pg_temp.log_competitive(
  '91000000-0000-4000-8000-000000000103',
  '91000000-0000-4000-8000-000000000013',
  now() - interval '90 days',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);

select results_eq(
  $$
    select candidate.mission_type::text
    from private.mission_candidates('10000000-0000-0000-0000-000000000002')
      as candidate
    where candidate.game_id in (
      '91000000-0000-4000-8000-000000000011',
      '91000000-0000-4000-8000-000000000012',
      '91000000-0000-4000-8000-000000000013'
    )
    order by candidate.mission_type::text
  $$,
  $$values ('continue_story'), ('resurrection'), ('revenge')$$,
  '6. Rewanż, Wskrzeszenie i Dokończ Historię nadal obejmują dodatki'
);

-- ===========================================================================
-- ZAPIS Z FORMULARZA
-- ===========================================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    select public.create_game_with_expansions(
      'QA Zapisany dodatek',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002',
      null, null, null, null, null, null, null, null,
      '{}'::text[], '{}'::text[], null, null, null, null, null,
      'available'::public.game_status,
      true
    )
  $$,
  '7. create_game_with_expansions przyjmuje klasyfikację pozycji'
);

select lives_ok(
  $$
    select public.create_game_with_expansions(
      'QA Zapisana gra samodzielna',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002',
      null, null, null, null, null, null, null, null,
      '{}'::text[], '{}'::text[], null, null, null, null, null,
      'available'::public.game_status,
      false
    )
  $$,
  '8. create_game_with_expansions zapisuje też grę samodzielną'
);

reset role;

select results_eq(
  $$
    select title, is_expansion
    from public.games
    where title in ('QA Zapisany dodatek', 'QA Zapisana gra samodzielna')
    order by title
  $$,
  $$values
    ('QA Zapisana gra samodzielna'::text, false),
    ('QA Zapisany dodatek'::text, true)
  $$,
  '9. obie pozycje trafiły do bazy z właściwą klasyfikacją'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    select public.update_game_with_expansions(
      (
        select id from public.games
        where title = 'QA Zapisany dodatek'
      ),
      'QA Zapisany dodatek',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002',
      null, null, null, null, null, null, null, null,
      '{}'::text[], '{}'::text[], null, null, null, null, null,
      'available'::public.game_status,
      false
    )
  $$,
  '10. update_game_with_expansions pozwala poprawić klasyfikację ręcznie'
);

reset role;

select is(
  (
    select is_expansion
    from public.games
    where title = 'QA Zapisany dodatek'
  ),
  false,
  '11. ręczna korekta nadpisuje podpowiedź BGG (standalone expansion)'
);

-- ===========================================================================
-- BRAK CICHEGO PRZECIĄŻENIA RPC
-- ===========================================================================
--
-- Stare sygnatury bez p_is_expansion muszą zniknąć. Gdyby zostały obok nowych,
-- wywołanie, które zapomni o klasyfikacji, po cichu trafiłoby w starą wersję i
-- zapisało grę z is_expansion = null — czyli pozycję na zawsze niewidoczną dla
-- Pierwszego Rozdziału, bez żadnego sygnału dla użytkownika.

select results_eq(
  $$
    select
      (
        select count(*)
        from pg_catalog.pg_proc as routine
        join pg_catalog.pg_namespace as schema_name
          on schema_name.oid = routine.pronamespace
        where schema_name.nspname = 'public'
          and routine.proname = 'create_game_with_expansions'
      ),
      (
        select count(*)
        from pg_catalog.pg_proc as routine
        join pg_catalog.pg_namespace as schema_name
          on schema_name.oid = routine.pronamespace
        where schema_name.nspname = 'public'
          and routine.proname = 'update_game_with_expansions'
      )
  $$,
  $$values (1::bigint, 1::bigint)$$,
  '12. każda RPC gier ma dokładnie jedną sygnaturę'
);

-- ===========================================================================
-- PODGLĄD OPERATORSKI
-- ===========================================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (
    select count(*)
    from public.preview_mission_generation() as preview
    join public.games as game on game.id = preview.game_id
    where preview.mission_type = 'first_chapter'
      and game.is_expansion is distinct from false
  ),
  0::bigint,
  '13. podgląd produkcyjny nie proponuje dodatków ani pozycji nierozstrzygniętych'
);

reset role;

select * from finish();
rollback;
