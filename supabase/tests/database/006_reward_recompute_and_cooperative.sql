-- Testy silnika przeliczania nagród oraz trybu kooperacyjnego.
--
-- Sprawdzamy trzy rzeczy, których nie pokrywa 001:
--   * cykl życia nagrody na księdze append-only (rewizje, kompensaty),
--   * nienaruszalność księgi i uprawnienia do funkcji silnika,
--   * niezmienniki trybu kooperacyjnego.

begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- ---------------------------------------------------------------------------
-- Fixture
-- ---------------------------------------------------------------------------

-- Gra i spotkanie potrzebne do zapisania partii.
insert into public.games (id, title, owner_id)
values (
  'c1000000-0000-4000-8000-000000000001',
  'Gra do testów nagród',
  '10000000-0000-0000-0000-000000000002'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 1. Pierwsze przyznanie: stan, rewizja i jedno zdarzenie
-- ---------------------------------------------------------------------------

-- Konwencja tego pliku: MUTACJE wykonujemy jako zalogowany członek (żeby
-- przechodziły przez realne RPC i kontrolę uprawnień), a ASERCJE jako
-- superuser (żeby RLS nie ukrywał cudzych wierszy i nie fałszował liczników).
create temporary table t_play as
select public.create_play_with_participants(
  'c1000000-0000-4000-8000-000000000001',
  '2026-05-01 18:00:00+00'::timestamptz,
  null,
  90,
  'Partia rywalizacyjna',
  jsonb_build_array(
    jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000002', 'placement', 1, 'is_winner', true),
    jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000003', 'placement', 2, 'is_winner', false)
  )
) as play_id;

reset role;

select results_eq(
  $$
    select is_active, revision
    from public.play_reward_states
    where user_id = '10000000-0000-0000-0000-000000000002'
      and reward_type = 'play_points'
      and reward_key = (select play_id::text from t_play)
  $$,
  $$values (true, 0)$$,
  '1. pierwsze przyznanie tworzy stan aktywny w rewizji 0'
);

select results_eq(
  $$
    select count(*)::bigint, coalesce(sum(points), 0)::bigint
    from public.point_events
    where action_type = 'play_logged'
      and related_entity_id = (select play_id from t_play)
  $$,
  $$values (1::bigint, 40::bigint)$$,
  '2. pierwsze przyznanie zapisuje dokładnie jedno dodatnie zdarzenie'
);

select ok(
  exists (
    select 1 from public.user_achievements
    where user_id = '10000000-0000-0000-0000-000000000002'
      and achievement_key = 'critical_roll'
  ),
  '3. pierwsze przyznanie zapisuje odznakę'
);

select results_eq(
  $$
    select action, revision
    from public.achievement_history
    where user_id = '10000000-0000-0000-0000-000000000002'
      and achievement_key = 'critical_roll'
  $$,
  $$values ('granted'::public.achievement_history_action, 0)$$,
  '4. pierwsze przyznanie zapisuje wpis historii granted w rewizji 0'
);

-- Niezmiennik: liczba zdarzeń nagrody = revision + 1.
select results_eq(
  $$
    select count(*)::bigint
    from public.play_reward_states as state
    where state.reward_type = 'play_points'
      and (
        select count(*)
        from public.point_events as event
        where event.user_id = state.user_id
          and event.action_type = 'play_logged'
          and event.related_entity_id = state.reward_key::uuid
      ) <> state.revision + 1
  $$,
  $$values (0::bigint)$$,
  '5. dla każdego stanu liczba zdarzeń wynosi revision + 1'
);

-- ---------------------------------------------------------------------------
-- 2. Warunek niespełniony: brak stanu i brak zdarzenia (ścieżka A)
-- ---------------------------------------------------------------------------

select results_eq(
  $$
    select count(*)::bigint
    from public.play_reward_states
    where user_id = '10000000-0000-0000-0000-000000000003'
      and reward_type = 'achievement'
      and reward_key = 'coast_chronicler'
  $$,
  $$values (0::bigint)$$,
  '6. niespełniony warunek nie tworzy stanu nagrody'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000003'
      and action_type = 'achievement_unlocked:coast_chronicler'
  $$,
  $$values (0::bigint)$$,
  '7. niespełniony warunek nie tworzy zdarzenia punktowego'
);

-- ---------------------------------------------------------------------------
-- 3. Powtórne przeliczenie niczego nie zmienia (ścieżka C)
-- ---------------------------------------------------------------------------

create temporary table t_before as
select
  (select count(*) from public.point_events) as events,
  (select coalesce(sum(revision), 0) from public.play_reward_states) as revisions;

select private.recompute_play_rewards(
  array['10000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000003'::uuid],
  (select play_id from t_play),
  'Powtórne przeliczenie'
) as changes;

select results_eq(
  $$select (select count(*) from public.point_events) = events from t_before$$,
  $$values (true)$$,
  '8. powtórne przeliczenie nie dodaje zdarzeń'
);

select results_eq(
  $$select (select coalesce(sum(revision), 0) from public.play_reward_states) = revisions from t_before$$,
  $$values (true)$$,
  '9. powtórne przeliczenie nie zmienia rewizji'
);

-- ---------------------------------------------------------------------------
-- 4. Cofnięcie: kompensata, rewizja 1, saldo do zera (ścieżka D)
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

-- Cofnięcie partii do stanu „w toku” odbiera punkty za zapis.
select public.update_play_with_participants(
  (select play_id from t_play),
  'c1000000-0000-4000-8000-000000000001',
  '2026-05-01 18:00:00+00'::timestamptz,
  null, 90, 'Partia wraca do toku',
  jsonb_build_array(
    jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000002', 'placement', 1, 'is_winner', false)
  ),
  'in_progress',
  'Dogrywamy w przyszłym tygodniu'
);

reset role;

select results_eq(
  $$
    select is_active, revision
    from public.play_reward_states
    where user_id = '10000000-0000-0000-0000-000000000002'
      and reward_type = 'play_points'
      and reward_key = (select play_id::text from t_play)
  $$,
  $$values (false, 1)$$,
  '10. cofnięcie ustawia stan nieaktywny i rewizję 1'
);

select results_eq(
  $$
    select count(*)::bigint, coalesce(sum(points), 0)::bigint
    from public.point_events
    where action_type = 'play_logged'
      and related_entity_id = (select play_id from t_play)
  $$,
  $$values (2::bigint, 0::bigint)$$,
  '11. cofnięcie dopisuje dokładnie jedno zdarzenie kompensujące, saldo nagrody wraca do zera'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.point_events
    where action_type = 'play_logged'
      and related_entity_id = (select play_id from t_play)
      and points < 0
  $$,
  $$values (1::bigint)$$,
  '12. istnieje dokładnie jedno zdarzenie ujemne'
);

-- ---------------------------------------------------------------------------
-- 5. Ponowne przyznanie: rewizja 2, trzy zdarzenia (cykl win -> loss -> win)
-- ---------------------------------------------------------------------------

select public.update_play_with_participants(
  (select play_id from t_play),
  'c1000000-0000-4000-8000-000000000001',
  '2026-05-01 18:00:00+00'::timestamptz,
  null, 90, 'Partia znów ukończona',
  jsonb_build_array(
    jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000002', 'placement', 1, 'is_winner', true)
  ),
  'completed'
);

select results_eq(
  $$
    select is_active, revision
    from public.play_reward_states
    where user_id = '10000000-0000-0000-0000-000000000002'
      and reward_type = 'play_points'
      and reward_key = (select play_id::text from t_play)
  $$,
  $$values (true, 2)$$,
  '13. ponowne przyznanie ustawia rewizję 2'
);

select results_eq(
  $$
    select count(*)::bigint, coalesce(sum(points), 0)::bigint
    from public.point_events
    where action_type = 'play_logged'
      and related_entity_id = (select play_id from t_play)
  $$,
  $$values (3::bigint, 40::bigint)$$,
  '14. cykl przyznanie-cofnięcie-przyznanie daje trzy zdarzenia i saldo wyjściowe'
);

-- ---------------------------------------------------------------------------
-- 6. Wartość punktowa pochodzi wyłącznie z serwera
-- ---------------------------------------------------------------------------

select results_eq(
  $$
    select distinct abs(points)
    from public.point_events
    where action_type = 'play_logged'
      and related_entity_id = (select play_id from t_play)
  $$,
  $$select private.point_reward_for('play_logged')$$,
  '15. wartość dodatnia i kompensująca pochodzi z serwerowego cennika'
);

select is(
  (
    select count(*)::bigint
    from pg_proc as proc
    join pg_namespace as ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname in ('create_play_with_participants', 'update_play_with_participants', 'delete_play')
      and pg_get_function_arguments(proc.oid) like '%points%'
  ),
  0::bigint,
  '16. publiczne RPC partii nie przyjmują żadnego parametru punktowego'
);

-- ---------------------------------------------------------------------------
-- 7. Uprawnienia do funkcji silnika
-- ---------------------------------------------------------------------------

select is(
  has_function_privilege('authenticated', 'private.recompute_play_rewards(uuid[],uuid,text)', 'EXECUTE'),
  false,
  '17. authenticated nie może wywołać przeliczania'
);

select is(
  has_function_privilege('authenticated', 'private.apply_reward_delta(uuid,public.reward_type,text,boolean,uuid,text)', 'EXECUTE'),
  false,
  '18. authenticated nie może wywołać apply_reward_delta'
);

select is(
  has_function_privilege('authenticated', 'private.revoke_achievement(uuid,text)', 'EXECUTE'),
  false,
  '19. authenticated nie może wywołać revoke_achievement'
);

select is(
  has_function_privilege('authenticated', 'private.reward_points_for(public.reward_type,text)', 'EXECUTE'),
  false,
  '20. authenticated nie może wywołać reward_points_for'
);

select is(
  has_function_privilege('anon', 'private.recompute_play_rewards(uuid[],uuid,text)', 'EXECUTE'),
  false,
  '21. anon nie może wywołać przeliczania'
);

select is(
  has_table_privilege('authenticated', 'public.user_achievements', 'DELETE'),
  false,
  '22. authenticated nie ma prawa DELETE na user_achievements'
);

select is(
  has_table_privilege('authenticated', 'public.play_reward_states', 'INSERT'),
  false,
  '23. authenticated nie ma prawa INSERT na play_reward_states'
);

select is(
  has_table_privilege('authenticated', 'public.achievement_history', 'INSERT'),
  false,
  '24. authenticated nie ma prawa INSERT na achievement_history'
);

-- ---------------------------------------------------------------------------
-- 8. Księga pozostaje append-only mimo kompensat
-- ---------------------------------------------------------------------------

-- Te trzy asercje muszą działać z perspektywy zwykłego członka.
set local role authenticated;

select throws_ok(
  $$update public.point_events set points = 1 where action_type = 'play_logged'$$,
  '42501',
  null,
  '25. zwykły użytkownik nadal nie może zmienić zdarzenia punktowego'
);

select throws_ok(
  $$delete from public.point_events where action_type = 'play_logged'$$,
  '42501',
  null,
  '26. zwykły użytkownik nadal nie może usunąć zdarzenia punktowego'
);

select throws_ok(
  $$delete from public.achievement_history$$,
  '42501',
  null,
  '27. historia odznak jest append-only'
);

reset role;

-- ---------------------------------------------------------------------------
-- 9. Tryb kooperacyjny — niezmienniki
-- ---------------------------------------------------------------------------

select lives_ok(
  $$
    select public.create_play_with_participants(
      'c1000000-0000-4000-8000-000000000001',
      '2026-05-02 18:00:00+00'::timestamptz,
      null, 60, 'Kooperacja wygrana',
      jsonb_build_array(
        jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000002', 'is_winner', true),
        jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000003', 'is_winner', true)
      ),
      'completed', null, 'cooperative', 'win'
    )
  $$,
  '28. kooperacyjna wygrana zapisuje się bez miejsc'
);

select lives_ok(
  $$
    select public.create_play_with_participants(
      'c1000000-0000-4000-8000-000000000001',
      '2026-05-03 18:00:00+00'::timestamptz,
      null, 60, 'Kooperacja przegrana',
      jsonb_build_array(
        jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000002', 'is_winner', false),
        jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000003', 'is_winner', false)
      ),
      'completed', null, 'cooperative', 'loss'
    )
  $$,
  '29. kooperacyjna PORAŻKA zapisuje się bez ani jednego zwycięzcy'
);

select throws_ok(
  $$
    select public.create_play_with_participants(
      'c1000000-0000-4000-8000-000000000001', now(), null, 60, 'Brak wyniku drużyny',
      jsonb_build_array(jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000002', 'is_winner', true)),
      'completed', null, 'cooperative', null
    )
  $$,
  '23514',
  null,
  '30. kooperacyjna partia ukończona wymaga wyniku drużyny'
);

select throws_ok(
  $$
    select public.create_play_with_participants(
      'c1000000-0000-4000-8000-000000000001', now(), null, 60, 'Miejsca w kooperacji',
      jsonb_build_array(jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000002', 'placement', 1, 'is_winner', true)),
      'completed', null, 'cooperative', 'win'
    )
  $$,
  '23514',
  null,
  '31. kooperacyjna partia nie może przechowywać miejsc'
);

select throws_ok(
  $$
    select public.create_play_with_participants(
      'c1000000-0000-4000-8000-000000000001', now(), null, 60, 'Niespójny zwycięzca',
      jsonb_build_array(
        jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000002', 'is_winner', true),
        jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000003', 'is_winner', false)
      ),
      'completed', null, 'cooperative', 'win'
    )
  $$,
  '23514',
  null,
  '32. kooperacyjna wygrana wymaga spójnego is_winner u wszystkich'
);

select throws_ok(
  $$
    select public.create_play_with_participants(
      'c1000000-0000-4000-8000-000000000001', now(), null, 60, 'Wynik w rywalizacji',
      jsonb_build_array(jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000002', 'placement', 1, 'is_winner', true)),
      'completed', null, 'competitive', 'win'
    )
  $$,
  '23514',
  null,
  '33. partia rywalizacyjna nie może nieść wyniku drużyny'
);

-- ---------------------------------------------------------------------------
-- 10. Usunięcie partii cofa jej skutki
-- ---------------------------------------------------------------------------

select public.delete_play((select play_id from t_play));

select results_eq(
  $$
    select coalesce(sum(points), 0)::bigint
    from public.point_events
    where action_type = 'play_logged'
      and related_entity_id = (select play_id from t_play)
  $$,
  $$values (0::bigint)$$,
  '34. usunięcie partii kompensuje jej punkty za zapis do zera'
);

reset role;
select * from finish();
rollback;
