begin;

create extension if not exists pgtap with schema extensions;
select plan(51);

-- ===========================================================================
-- Misje v1 — faktyczna specyfikacja reguł.
--
-- Fixture'y seed.sql: Przemek = admin, Marta/Michał/Ania/Kuba = aktywni
-- członkowie, Nieaktywny = konto wyłączone. Asercje wykonujemy jako superuser,
-- żeby RLS nie fałszował wyniku; osobna sekcja na końcu sprawdza samo RLS.
--
-- Cała historia grupy z seed.sql jest tu wyczyszczona, a wszystkie gry
-- zarchiwizowane — inaczej kandydaci z danych demonstracyjnych mieszaliby się
-- ze scenariuszami i testy zależałyby od kolejności seedowania.
-- ===========================================================================

create temp table mission_test_renown as
select
  point_event.user_id,
  coalesce(sum(point_event.points), 0)::bigint as total_points
from public.point_events as point_event
group by point_event.user_id;

delete from public.plays;
update public.games set archived_at = now();

-- Świeży stan między scenariuszami. Wyłączenie triggera append-only jest
-- zabiegiem WYŁĄCZNIE testowym: produkcyjnie nie istnieje ścieżka kasująca
-- ledger, co sprawdzają asercje 32–33.
create function pg_temp.reset_world() returns void
language plpgsql
as $$
begin
  delete from public.user_missions;
  delete from public.plays;
  alter table public.tukat_events disable trigger tukat_events_append_only;
  delete from public.tukat_events;
  alter table public.tukat_events enable trigger tukat_events_append_only;
end;
$$;

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

create function pg_temp.log_cooperative(
  p_play_id uuid,
  p_game_id uuid,
  p_played_at timestamptz,
  p_player_one uuid,
  p_player_two uuid,
  p_team_result public.play_team_result
) returns void
language plpgsql
as $$
begin
  insert into public.plays (
    id, game_id, created_by, played_at, status, mode, team_result, rewards_managed
  )
  values (
    p_play_id, p_game_id, p_player_one, p_played_at, 'completed', 'cooperative',
    p_team_result, true
  );

  insert into public.play_participants (play_id, user_id, placement, is_winner)
  values
    (p_play_id, p_player_one, null, p_team_result = 'win'),
    (p_play_id, p_player_two, null, p_team_result = 'win');
end;
$$;

create function pg_temp.reconcile_marta() returns integer
language sql
as $$
  select private.reconcile_user_missions(
    array['10000000-0000-0000-0000-000000000002'::uuid],
    null,
    'pgtap'
  );
$$;

create function pg_temp.candidate_count(
  p_user_id uuid,
  p_mission_type public.mission_type,
  p_game_id uuid
) returns bigint
language sql
as $$
  select count(*)
  from private.mission_candidates(p_user_id) as candidate
  where candidate.mission_type = p_mission_type
    and candidate.game_id = p_game_id;
$$;

-- Gry testowe. Właścicielem jest Michał wszędzie tam, gdzie Półka Marty
-- mogłaby wygenerować niechcianego kandydata „Pierwszy Rozdział”.
--
-- `is_expansion = false` jest tu WYMAGANE, a nie ozdobne: od migracji
-- 20260825120000 Pierwszy Rozdział kwalifikuje wyłącznie pozycje sklasyfikowane
-- jako samodzielne, a pozycja nierozstrzygnięta (null) jest celowo pomijana.
-- Rozróżnienie dodatku od gry bazowej ma własny plik testowy (030).
insert into public.games (id, title, owner_id, status, is_expansion) values
  ('90000000-0000-4000-8000-000000000001', 'QA Rewanż', '10000000-0000-0000-0000-000000000003', 'available', false),
  ('90000000-0000-4000-8000-000000000002', 'QA Wskrzeszenie', '10000000-0000-0000-0000-000000000003', 'available', false),
  ('90000000-0000-4000-8000-000000000003', 'QA Pierwszy Rozdział', '10000000-0000-0000-0000-000000000002', 'available', false),
  ('90000000-0000-4000-8000-000000000004', 'QA Dokończ Historię', '10000000-0000-0000-0000-000000000003', 'available', false),
  ('90000000-0000-4000-8000-000000000005', 'QA Kooperacja', '10000000-0000-0000-0000-000000000003', 'available', false),
  ('90000000-0000-4000-8000-000000000006', 'QA Druga Półka', '10000000-0000-0000-0000-000000000002', 'available', false);

-- ===========================================================================
-- REWANŻ
-- ===========================================================================

select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000101',
  '90000000-0000-4000-8000-000000000001',
  now() - interval '2 days',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002'
);

select is(
  pg_temp.candidate_count(
    '10000000-0000-0000-0000-000000000002',
    'revenge',
    '90000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  '1. przegrana partia rywalizacyjna tworzy kandydata na Rewanż'
);

select pg_temp.reconcile_marta();

select results_eq(
  $$
    select status, reward_amount, (expires_at::date - generated_at::date)
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000002'
      and mission_type = 'revenge'
  $$,
  $$values ('active'::public.mission_status, 15, 30)$$,
  '2. Rewanż jest aktywny, płaci 15 Tukatów i żyje 30 dni'
);

select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000102',
  '90000000-0000-4000-8000-000000000001',
  now() - interval '2 days',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);

select is(
  pg_temp.candidate_count(
    '10000000-0000-0000-0000-000000000002',
    'revenge',
    '90000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  '3. wygrana nie tworzy kandydata na Rewanż'
);

select pg_temp.reset_world();
select pg_temp.log_cooperative(
  '90000000-0000-4000-8000-000000000103',
  '90000000-0000-4000-8000-000000000005',
  now() - interval '2 days',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  'loss'
);

select is(
  pg_temp.candidate_count(
    '10000000-0000-0000-0000-000000000002',
    'revenge',
    '90000000-0000-4000-8000-000000000005'
  ),
  0::bigint,
  '4. porażka kooperacyjna nie tworzy Rewanżu — przegrywa drużyna, nie gracz'
);

select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000104',
  '90000000-0000-4000-8000-000000000001',
  now() - interval '2 days',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002'
);
select pg_temp.reconcile_marta();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000105',
  '90000000-0000-4000-8000-000000000001',
  now() + interval '1 minute',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);
select pg_temp.reconcile_marta();

select is(
  (
    select status
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000002'
      and mission_type = 'revenge'
  ),
  'completed'::public.mission_status,
  '5. późniejsze zwycięstwo w tej samej grze domyka Rewanż'
);

select results_eq(
  $$
    select count(*), coalesce(sum(amount), 0)::integer
    from public.tukat_events
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$values (1::bigint, 15)$$,
  '6. ukończony Rewanż płaci dokładnie raz i dokładnie 15 Tukatów'
);

select pg_temp.reconcile_marta();

select is(
  (
    select count(*)
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000002'
      and mission_type = 'revenge'
  ),
  1::bigint,
  '7. powtórzony reconcile nie tworzy drugiego Rewanżu tej samej gry'
);

-- Cooldown liczy się od zamknięcia poprzedniej instancji, więc świeża
-- porażka w tej samej grze NIE odblokowuje od razu kolejnego Rewanżu.
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000106',
  '90000000-0000-4000-8000-000000000001',
  now() + interval '2 minutes',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002'
);
select pg_temp.reconcile_marta();

select is(
  (
    select count(*)
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000002'
      and mission_type = 'revenge'
      and status = 'active'
  ),
  0::bigint,
  '8. cooldown blokuje kolejny Rewanż tej samej gry'
);

update public.user_missions
set completed_at = now() - interval '31 days'
where user_id = '10000000-0000-0000-0000-000000000002'
  and mission_type = 'revenge'
  and status = 'completed';

select pg_temp.reconcile_marta();

select is(
  (
    select count(*)
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000002'
      and mission_type = 'revenge'
      and status = 'active'
  ),
  1::bigint,
  '9. po upływie cooldownu Rewanż może powstać ponownie'
);

-- ===========================================================================
-- WSKRZESZENIE
-- ===========================================================================

select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000111',
  '90000000-0000-4000-8000-000000000002',
  now() - interval '179 days',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);

select is(
  pg_temp.candidate_count(
    '10000000-0000-0000-0000-000000000002',
    'resurrection',
    '90000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  '10. 179 dni przerwy to jeszcze nie Wskrzeszenie'
);

select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000112',
  '90000000-0000-4000-8000-000000000002',
  now() - interval '180 days',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);

select is(
  pg_temp.candidate_count(
    '10000000-0000-0000-0000-000000000002',
    'resurrection',
    '90000000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  '11. 180 dni przerwy tworzy kandydata na Wskrzeszenie'
);

select pg_temp.reconcile_marta();

select results_eq(
  $$
    select status, reward_amount, (expires_at::date - generated_at::date)
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000002'
      and mission_type = 'resurrection'
  $$,
  $$values ('active'::public.mission_status, 15, 45)$$,
  '12. Wskrzeszenie jest aktywne, płaci 15 Tukatów i żyje 45 dni'
);

select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000113',
  '90000000-0000-4000-8000-000000000002',
  now() + interval '1 minute',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002'
);
select pg_temp.reconcile_marta();

select is(
  (
    select status
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000002'
      and mission_type = 'resurrection'
  ),
  'completed'::public.mission_status,
  '13. powrót do gry domyka Wskrzeszenie — bez wymogu wygranej'
);

-- ===========================================================================
-- PIERWSZY ROZDZIAŁ
-- ===========================================================================

select pg_temp.reset_world();

select is(
  pg_temp.candidate_count(
    '10000000-0000-0000-0000-000000000002',
    'first_chapter',
    '90000000-0000-4000-8000-000000000003'
  ),
  1::bigint,
  '14. gra z własnej Półki bez ani jednej partii tworzy Pierwszy Rozdział'
);

select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000121',
  '90000000-0000-4000-8000-000000000003',
  now() - interval '10 days',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);

select is(
  pg_temp.candidate_count(
    '10000000-0000-0000-0000-000000000002',
    'first_chapter',
    '90000000-0000-4000-8000-000000000003'
  ),
  0::bigint,
  '15. wcześniejsza ukończona partia usuwa kandydata na Pierwszy Rozdział'
);

select pg_temp.reset_world();
select pg_temp.reconcile_marta();

select is(
  (
    select count(*)
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000002'
      and mission_type = 'first_chapter'
      and status = 'active'
  ),
  1::bigint,
  '16. dwie nierozegrane gry na Półce dają JEDEN Pierwszy Rozdział, nie dwa'
);

-- ===========================================================================
-- DOKOŃCZ HISTORIĘ
-- ===========================================================================

select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000131',
  '90000000-0000-4000-8000-000000000004',
  now() - interval '59 days',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);

select is(
  pg_temp.candidate_count(
    '10000000-0000-0000-0000-000000000002',
    'continue_story',
    '90000000-0000-4000-8000-000000000004'
  ),
  0::bigint,
  '17. 59 dni przerwy to jeszcze nie Dokończ Historię'
);

select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000132',
  '90000000-0000-4000-8000-000000000004',
  now() - interval '60 days',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);

select is(
  pg_temp.candidate_count(
    '10000000-0000-0000-0000-000000000002',
    'continue_story',
    '90000000-0000-4000-8000-000000000004'
  ),
  1::bigint,
  '18. 60 dni przerwy tworzy kandydata na Dokończ Historię'
);

select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000133',
  '90000000-0000-4000-8000-000000000004',
  now() - interval '179 days',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);

select is(
  pg_temp.candidate_count(
    '10000000-0000-0000-0000-000000000002',
    'continue_story',
    '90000000-0000-4000-8000-000000000004'
  ),
  1::bigint,
  '19. 179 dni przerwy to nadal Dokończ Historię'
);

select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000134',
  '90000000-0000-4000-8000-000000000004',
  now() - interval '180 days',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);

select results_eq(
  $$
    select
      pg_temp.candidate_count(
        '10000000-0000-0000-0000-000000000002',
        'resurrection',
        '90000000-0000-4000-8000-000000000004'
      ),
      pg_temp.candidate_count(
        '10000000-0000-0000-0000-000000000002',
        'continue_story',
        '90000000-0000-4000-8000-000000000004'
      )
  $$,
  $$values (1::bigint, 0::bigint)$$,
  '20. przy 180 dniach Wskrzeszenie ma pierwszeństwo przed Dokończ Historię'
);

-- ===========================================================================
-- LIMITY, KWALIFIKACJA, CYKL ŻYCIA
-- ===========================================================================

select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000141',
  '90000000-0000-4000-8000-000000000001',
  now() - interval '2 days',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002'
);
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000142',
  '90000000-0000-4000-8000-000000000002',
  now() - interval '200 days',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000143',
  '90000000-0000-4000-8000-000000000004',
  now() - interval '90 days',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);
select pg_temp.reconcile_marta();

select results_eq(
  $$
    select mission_type::text
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000002'
      and status = 'active'
    order by mission_type::text
  $$,
  $$values ('resurrection'), ('revenge')$$,
  '21. przy czterech kandydatach generator kończy na dwóch, wg priorytetów'
);

-- Trzeci slot istnieje w bazie (zostaje na przyszłą Misję Spotkaniową), ale
-- czwarta aktywna Misja jest niemożliwa niezależnie od tego, kto ją wstawia.
insert into public.user_missions (
  user_id, mission_type, game_id, expires_at, reward_amount, cooldown_key
)
values (
  '10000000-0000-0000-0000-000000000002',
  'first_chapter',
  '90000000-0000-4000-8000-000000000003',
  now() + interval '45 days',
  10,
  '90000000-0000-4000-8000-000000000003'
);

select throws_ok(
  $$
    insert into public.user_missions (
      user_id, mission_type, game_id, expires_at, reward_amount, cooldown_key
    )
    values (
      '10000000-0000-0000-0000-000000000002',
      'continue_story',
      '90000000-0000-4000-8000-000000000004',
      now() + interval '30 days',
      10,
      '90000000-0000-4000-8000-000000000004'
    )
  $$,
  '23514',
  null,
  '22. twardy sufit trzech aktywnych Misji egzekwuje baza, nie tylko generator'
);

select pg_temp.reset_world();
update public.app_members
set role = 'observer'
where user_id = '10000000-0000-0000-0000-000000000005';

select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000151',
  '90000000-0000-4000-8000-000000000001',
  now() - interval '2 days',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000005'
);
select private.reconcile_user_missions(
  array['10000000-0000-0000-0000-000000000005'::uuid], null, 'pgtap'
);

select is(
  (
    select count(*)
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000005'
  ),
  0::bigint,
  '23. obserwator nie dostaje Misji'
);

select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000152',
  '90000000-0000-4000-8000-000000000001',
  now() - interval '2 days',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000006'
);
select private.reconcile_user_missions(
  array['10000000-0000-0000-0000-000000000006'::uuid], null, 'pgtap'
);

select is(
  (
    select count(*)
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000006'
  ),
  0::bigint,
  '24. konto nieaktywne nie dostaje Misji'
);

select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000153',
  '90000000-0000-4000-8000-000000000001',
  now() - interval '2 days',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001'
);
select private.reconcile_user_missions(
  array['10000000-0000-0000-0000-000000000001'::uuid], null, 'pgtap'
);

select is(
  (
    select count(*)
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000001'
      and mission_type = 'revenge'
      and status = 'active'
  ),
  1::bigint,
  '25. administrator będący graczem dostaje Misje'
);

select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000161',
  '90000000-0000-4000-8000-000000000001',
  now() - interval '2 days',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002'
);
select pg_temp.reconcile_marta();

-- Cofamy CAŁE okno życia Misji, nie samo expires_at: baza pilnuje niezmiennika
-- expires_at > generated_at, więc „przeterminowanie” trzeba udawać uczciwie.
update public.user_missions
set
  generated_at = now() - interval '40 days',
  expires_at = now() - interval '1 minute'
where user_id = '10000000-0000-0000-0000-000000000002'
  and status = 'active';

select pg_temp.reconcile_marta();

select results_eq(
  $$
    select
      (
        select count(*)
        from public.user_missions
        where user_id = '10000000-0000-0000-0000-000000000002'
          and mission_type = 'revenge'
          and status = 'expired'
      ),
      (
        select count(*)
        from public.tukat_events
        where user_id = '10000000-0000-0000-0000-000000000002'
      ),
      (
        select count(*)
        from pg_catalog.pg_enum as label
        join pg_catalog.pg_type as enum_type
          on enum_type.oid = label.enumtypid
        where enum_type.typname = 'mission_status'
          and label.enumlabel = 'failed'
      )
  $$,
  $$values (1::bigint, 0::bigint, 0::bigint)$$,
  '26. wygaśnięcie nie jest porażką: status expired, zero wypłat, brak statusu failed'
);

select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000171',
  '90000000-0000-4000-8000-000000000001',
  now() - interval '2 days',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002'
);
select pg_temp.reconcile_marta();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000172',
  '90000000-0000-4000-8000-000000000001',
  now() + interval '1 minute',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);
select pg_temp.reconcile_marta();
select pg_temp.reconcile_marta();
select pg_temp.reconcile_marta();

select results_eq(
  $$
    select
      (
        select count(*)
        from public.user_missions
        where user_id = '10000000-0000-0000-0000-000000000002'
          and status = 'completed'
      ),
      (
        select count(*)
        from public.tukat_events
        where user_id = '10000000-0000-0000-0000-000000000002'
      )
  $$,
  $$values (1::bigint, 1::bigint)$$,
  '27. trzy przebiegi reconcile domykają Misję raz i płacą raz'
);

create temp table mission_test_idempotency as
select
  (
    select count(*)
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000002'
  ) as missions_before,
  (
    select count(*)
    from public.tukat_events
    where user_id = '10000000-0000-0000-0000-000000000002'
  ) as ledger_before;

select pg_temp.reconcile_marta();

select results_eq(
  $$
    select
      (
        select count(*)
        from public.user_missions
        where user_id = '10000000-0000-0000-0000-000000000002'
      ),
      (
        select count(*)
        from public.tukat_events
        where user_id = '10000000-0000-0000-0000-000000000002'
      )
  $$,
  $$select missions_before, ledger_before from mission_test_idempotency$$,
  '28. kolejny reconcile nie zmienia ani liczby Misji, ani liczby wypłat'
);

-- ===========================================================================
-- ŻETONY LEGENDY
-- ===========================================================================

-- Saldo czytamy jako gracz, nie jako superuser: widok jest security_invoker i
-- celowo pokazuje wyłącznie własny wiersz — dokładnie jak user_point_balances.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (
    select total_tukats
    from public.tukat_balances
    where user_id = '10000000-0000-0000-0000-000000000002'
  ),
  15::bigint,
  '29. saldo Tukatów to dokładnie suma ledgera'
);

reset role;

select is(
  (
    select count(*)
    from public.point_events
    where action_type ilike '%mission%'
       or related_entity_type = 'mission'
  ),
  0::bigint,
  '30. Misje nie dopisują niczego do point_events'
);

select is(
  (
    select coalesce(sum(point_event.points), 0)::bigint
    from public.point_events as point_event
    where point_event.user_id = '10000000-0000-0000-0000-000000000002'
  ),
  (
    select coalesce(snapshot.total_points, 0)
    from mission_test_renown as snapshot
    where snapshot.user_id = '10000000-0000-0000-0000-000000000002'
  ),
  '31. Renoma gracza jest nietknięta mimo ukończonej i opłaconej Misji'
);

select throws_ok(
  $$
    update public.tukat_events
    set amount = 999
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  '0A000',
  null,
  '32. ledger Tukatów jest append-only — UPDATE odrzucony'
);

select throws_ok(
  $$
    delete from public.tukat_events
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  '0A000',
  null,
  '33. ledger Tukatów jest append-only — DELETE odrzucony'
);

-- ===========================================================================
-- RLS
-- ===========================================================================

select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000181',
  '90000000-0000-4000-8000-000000000001',
  now() - interval '2 days',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002'
);
select pg_temp.reconcile_marta();
select private.reconcile_user_missions(
  array['10000000-0000-0000-0000-000000000003'::uuid], null, 'pgtap'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (
    select count(*) > 0
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000002'
  ),
  true,
  '34. gracz widzi własne Misje'
);

select is(
  (
    select count(*)
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000003'
  ),
  0::bigint,
  '35. gracz nie widzi cudzych Misji'
);

reset role;

-- ===========================================================================
-- RPC Stołu
-- ===========================================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select active_count from public.recompute_current_user_missions()),
  2::integer,
  '36. reconcile ze Stołu widzi dokładnie dwie aktywne Misje wołającego'
);

select results_eq(
  $$
    select expired_count, completed_count, generated_count
    from public.recompute_current_user_missions()
  $$,
  $$values (0, 0, 0)$$,
  '37. kolejne wejście na Stół niczego nie wygasza, nie domyka i nie tworzy'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
set local role authenticated;

-- Obserwator ma zobaczyć Stół, tylko bez Misji — reconcile nie może mu
-- wysypać strony błędem uprawnień.
select results_eq(
  $$
    select expired_count, completed_count, generated_count, active_count
    from public.recompute_current_user_missions()
  $$,
  $$values (0, 0, 0, 0)$$,
  '38. obserwator dostaje zera zamiast błędu'
);

reset role;

-- ===========================================================================
-- JEDNA GRA = JEDNA AKTYWNA MISJA
--
-- Typy nie są rozłączne po grze: ten sam tytuł bywa jednocześnie kandydatem na
-- Rewanż i na Wskrzeszenie/Dokończ Historię. Bez tej reguły jeden wieczór przy
-- jednym tytule zamykałby dwie Misje i płacił dwa razy.
-- ===========================================================================

select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000191',
  '90000000-0000-4000-8000-000000000001',
  now() - interval '90 days',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002'
);

-- Ta sama gra kwalifikuje się i na Rewanż (ostatnia partia przegrana), i na
-- Dokończ Historię (90 dni przerwy) — kandydaci są dwaj, Misja ma być jedna.
select results_eq(
  $$
    select count(*)
    from private.mission_candidates('10000000-0000-0000-0000-000000000002')
      as candidate
    where candidate.game_id = '90000000-0000-4000-8000-000000000001'
  $$,
  $$values (2::bigint)$$,
  '39. jedna gra potrafi być kandydatem na dwa typy Misji naraz'
);

select pg_temp.reconcile_marta();

select results_eq(
  $$
    select mission_type::text
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000002'
      and game_id = '90000000-0000-4000-8000-000000000001'
      and status = 'active'
  $$,
  $$values ('revenge')$$,
  '40. Rewanż + Dokończ Historię dla tej samej gry → zostaje sam Rewanż'
);

select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000192',
  '90000000-0000-4000-8000-000000000002',
  now() - interval '200 days',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002'
);
select pg_temp.reconcile_marta();

select results_eq(
  $$
    select mission_type::text
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000002'
      and game_id = '90000000-0000-4000-8000-000000000002'
      and status = 'active'
  $$,
  $$values ('revenge')$$,
  '41. Rewanż + Wskrzeszenie dla tej samej gry → zostaje sam Rewanż'
);

-- Reguła dotyczy GRY, nie typu: dwie różne gry nadal dają dwie różne Misje.
select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000193',
  '90000000-0000-4000-8000-000000000001',
  now() - interval '2 days',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002'
);
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000194',
  '90000000-0000-4000-8000-000000000002',
  now() - interval '200 days',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);
select pg_temp.reconcile_marta();

select results_eq(
  $$
    select mission_type::text, game_id
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000002'
      and status = 'active'
    order by mission_type::text
  $$,
  $$values
    ('resurrection', '90000000-0000-4000-8000-000000000002'::uuid),
    ('revenge', '90000000-0000-4000-8000-000000000001'::uuid)
  $$,
  '42. dwie różne gry dają dwie różne Misje — limit dotyczy gry, nie typu'
);

-- Twardy niezmiennik, nie tylko dyscyplina generatora: druga aktywna Misja dla
-- tej samej gry jest niemożliwa niezależnie od tego, kto próbuje ją wstawić.
select throws_ok(
  $$
    insert into public.user_missions (
      user_id, mission_type, game_id, expires_at, reward_amount, cooldown_key
    )
    values (
      '10000000-0000-0000-0000-000000000002',
      'continue_story',
      '90000000-0000-4000-8000-000000000001',
      now() + interval '30 days',
      10,
      '90000000-0000-4000-8000-000000000001'
    )
  $$,
  '23505',
  null,
  '43. baza odrzuca drugą aktywną Misję dla gry, która już jakąś ma'
);

-- Sedno całego hardeningu: jedna rozegrana partia nie może zamknąć dwóch
-- zwykłych Misji tego samego tytułu i wypłacić podwójnej nagrody.
select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000195',
  '90000000-0000-4000-8000-000000000001',
  now() - interval '90 days',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002'
);
select pg_temp.reconcile_marta();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000196',
  '90000000-0000-4000-8000-000000000001',
  now() + interval '1 minute',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);
select pg_temp.reconcile_marta();

select results_eq(
  $$
    select
      (
        select count(*)
        from public.user_missions
        where user_id = '10000000-0000-0000-0000-000000000002'
          and game_id = '90000000-0000-4000-8000-000000000001'
          and status = 'completed'
      ),
      (
        select count(*)
        from public.tukat_events
        where user_id = '10000000-0000-0000-0000-000000000002'
      ),
      (
        select coalesce(sum(amount), 0)::integer
        from public.tukat_events
        where user_id = '10000000-0000-0000-0000-000000000002'
      )
  $$,
  $$values (1::bigint, 1::bigint, 15)$$,
  '44. jedna partia domyka jedną Misję tej gry i płaci raz, nie dwa razy'
);

select is(
  (
    select count(*)
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
      and (action_type ilike '%tukat%' or action_type ilike '%mission%')
  ),
  0::bigint,
  '45. wypłata Tukatów nie zostawia śladu w ledgerze Renomy'
);

-- ===========================================================================
-- GLOBALNY COOLDOWN GRY PO WYGAŚNIĘCIU
--
-- Cooldowny per (typ, gra) blokują wyłącznie powtórkę tego samego wyzwania.
-- Bez reguły globalnej wygasły Rewanż dla danej gry wracałby nazajutrz jako
-- Dokończ Historię — przeczekanie Misji nic by nie kosztowało.
--
-- Fixture: jedna przegrana partia sprzed 90 dni. Ta sama gra kwalifikuje się
-- wtedy i na Rewanż (ostatnia partia przegrana), i na Dokończ Historię
-- (90 dni przerwy), więc po wygaśnięciu Rewanżu drugi typ jest realnym
-- kandydatem i naprawdę jest co blokować.
-- ===========================================================================

select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000201',
  '90000000-0000-4000-8000-000000000001',
  now() - interval '90 days',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002'
);
select pg_temp.reconcile_marta();

update public.user_missions
set
  generated_at = now() - interval '40 days',
  expires_at = now() - interval '10 days'
where user_id = '10000000-0000-0000-0000-000000000002'
  and game_id = '90000000-0000-4000-8000-000000000001'
  and status = 'active';

select pg_temp.reconcile_marta();

select results_eq(
  $$
    select
      private.mission_game_expiry_cooldown_active(
        '10000000-0000-0000-0000-000000000002',
        '90000000-0000-4000-8000-000000000001'
      ),
      (
        select count(*)
        from public.user_missions
        where user_id = '10000000-0000-0000-0000-000000000002'
          and game_id = '90000000-0000-4000-8000-000000000001'
          and status = 'active'
      )
  $$,
  $$values (true, 0::bigint)$$,
  '46. wygasły Rewanż blokuje Dokończ Historię tej gry przed upływem 30 dni'
);

-- Inna gra nie ma z tym nic wspólnego: cooldown jest per gra, nie globalny dla
-- gracza. Świeża porażka w drugim tytule nadal daje Misję.
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000202',
  '90000000-0000-4000-8000-000000000002',
  now() - interval '2 days',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002'
);
select pg_temp.reconcile_marta();

select results_eq(
  $$
    select
      (
        select count(*)
        from public.user_missions
        where user_id = '10000000-0000-0000-0000-000000000002'
          and game_id = '90000000-0000-4000-8000-000000000001'
          and status = 'active'
      ),
      (
        select count(*)
        from public.user_missions
        where user_id = '10000000-0000-0000-0000-000000000002'
          and game_id = '90000000-0000-4000-8000-000000000002'
          and status = 'active'
      )
  $$,
  $$values (0::bigint, 1::bigint)$$,
  '47. cooldown jednej gry nie blokuje Misji dla innego tytułu'
);

-- Podgląd operatorski musi liczyć TĄ SAMĄ regułą i nazwać ją po imieniu —
-- inaczej wdrożenie zatwierdzałoby się na innych zasadach, niż działa APPLY.
select results_eq(
  $$
    select plan.would_generate, plan.skip_reason
    from private.mission_generation_plan() as plan
    where plan.user_id = '10000000-0000-0000-0000-000000000002'
      and plan.game_id = '90000000-0000-4000-8000-000000000001'
      and plan.mission_type = 'continue_story'
  $$,
  $$values (
    false,
    'gra odpoczywa 30 dni po wygaśnięciu poprzedniej Misji tego tytułu'
  )$$,
  '48. podgląd produkcyjny stosuje tę samą regułę i podaje właściwy powód'
);

-- Granica: dokładnie 30 dni od wygaśnięcia gra wraca do puli.
--
-- Osobny scenariusz, a nie ciąg dalszy poprzedniego: tam Marta ma już dwie
-- aktywne Misje, więc brak nowej Misji nie dowodziłby niczego o cooldownie.
select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000203',
  '90000000-0000-4000-8000-000000000001',
  now() - interval '90 days',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002'
);
select pg_temp.reconcile_marta();

update public.user_missions
set
  generated_at = now() - interval '60 days',
  expires_at = now() - interval '30 days'
where user_id = '10000000-0000-0000-0000-000000000002'
  and game_id = '90000000-0000-4000-8000-000000000001'
  and status = 'active';

select pg_temp.reconcile_marta();

select results_eq(
  $$
    select
      private.mission_game_expiry_cooldown_active(
        '10000000-0000-0000-0000-000000000002',
        '90000000-0000-4000-8000-000000000001'
      ),
      (
        select count(*)
        from public.user_missions
        where user_id = '10000000-0000-0000-0000-000000000002'
          and game_id = '90000000-0000-4000-8000-000000000001'
          and status = 'active'
      )
  $$,
  $$values (false, 1::bigint)$$,
  '49. po 30 dniach gra wraca do puli, jeśli nadal się kwalifikuje'
);

-- UKOŃCZENIE nie zakłada blokady. Powrót do porzuconej gry domyka Dokończ
-- Historię, a przegrana przy tej samej okazji ma prawo od razu zrodzić Rewanż —
-- to nowa sytuacja, nie obejście cooldownu.
select pg_temp.reset_world();
select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000211',
  '90000000-0000-4000-8000-000000000001',
  now() - interval '90 days',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);
select pg_temp.reconcile_marta();

select is(
  (
    select mission_type::text
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000002'
      and game_id = '90000000-0000-4000-8000-000000000001'
      and status = 'active'
  ),
  'continue_story',
  '50. wygrana sprzed 90 dni daje Dokończ Historię, nie Rewanż'
);

select pg_temp.log_competitive(
  '90000000-0000-4000-8000-000000000212',
  '90000000-0000-4000-8000-000000000001',
  now() + interval '1 minute',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002'
);
select pg_temp.reconcile_marta();

select results_eq(
  $$
    select mission_type::text, status::text
    from public.user_missions
    where user_id = '10000000-0000-0000-0000-000000000002'
      and game_id = '90000000-0000-4000-8000-000000000001'
    order by mission_type::text
  $$,
  $$values ('continue_story', 'completed'), ('revenge', 'active')$$,
  '51. ukończona Misja nie blokuje gry — przegrana od razu rodzi Rewanż'
);

select * from finish();
rollback;
