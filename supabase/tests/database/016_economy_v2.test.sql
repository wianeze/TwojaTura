begin;

create extension if not exists pgtap with schema extensions;
select plan(55);

-- Pokrywa Economy V2:
--   20260810120000_economy_v2_price_list.sql
--   20260810120100_play_participated_rewards.sql
--   20260810120200_economy_v2_rebase.sql
--
-- Konwencja jak w 006/013: MUTACJE jako zalogowany członek (przez realne RPC,
-- żeby przechodziły przez kontrolę uprawnień), ASERCJE jako superuser (żeby
-- RLS nie chował cudzych wierszy i nie fałszował sum).
--
-- Fixture'y z seed.sql:
--   ...0001 Przemek  admin,  active
--   ...0002 Marta    member, active
--   ...0003 Michał   member, active
--   ...0004 Ania     member, active
--   ...0005 Kuba     member, active
--   gry: ...0001 Nemesis, ...0002 Frostpunk, ...0003 XCOM

create temporary table t_ids (name text primary key, id uuid);
grant insert, select, update on t_ids to authenticated;

create or replace function pg_temp.renown(
  p_user_id uuid,
  p_action_type text,
  p_entity_id uuid
)
returns bigint
language sql
stable
as $$
  select coalesce(sum(event.points), 0)::bigint
  from public.point_events as event
  where event.user_id = p_user_id
    and event.action_type = p_action_type
    and event.related_entity_id = p_entity_id;
$$;

-- Saldo nagrody za partię liczone przez CAŁĄ rodzinę typów: historyczne
-- 'play_logged' i bieżące 'play_participated'. Tak samo liczy je silnik.
create or replace function pg_temp.play_renown(p_user_id uuid, p_play_id uuid)
returns bigint
language sql
stable
as $$
  select coalesce(sum(event.points), 0)::bigint
  from public.point_events as event
  where event.user_id = p_user_id
    and event.action_type in ('play_participated', 'play_logged')
    and event.related_entity_type = 'play'
    and event.related_entity_id = p_play_id;
$$;

-- ---------------------------------------------------------------------------
-- 1. Cennik
-- ---------------------------------------------------------------------------

select is(
  private.point_reward_for('meeting_rsvp'), 2,
  '1. odpowiedź na spotkanie to dokładnie 2 Renomy'
);

select is(
  private.point_reward_for('meeting_vote'), 1,
  '2. głos na grę to dokładnie 1 Renoma'
);

select is(
  private.point_reward_for('rating_created'), 3,
  '3. ocena gry to dokładnie 3 Renomy'
);

select is(
  private.point_reward_for('play_participated'), 5,
  '4. udział w partii to dokładnie 5 Renomy'
);

select results_eq(
  $$
    select action_type, private.point_reward_for(action_type)
    from unnest(array[
      'shelf_first_game', 'shelf_5_games', 'shelf_10_games', 'shelf_15_games'
    ]) as milestone(action_type)
    order by private.point_reward_for(action_type)
  $$,
  $$
    values
      ('shelf_first_game', 10),
      ('shelf_5_games', 15),
      ('shelf_10_games', 20),
      ('shelf_15_games', 25)
  $$,
  '5. milestone Półki rośnie wraz z trudnością progu (10/15/20/25)'
);

-- Stara nagroda creator-only zniknęła z cennika, czyli także z allow-listy
-- panelu korekt administratora.
select throws_ok(
  $$select private.point_reward_for('play_logged')$$,
  '22023',
  null,
  '6. play_logged = 40 nie jest już przyznawalne'
);

-- RPC zostaje wyłącznie jako wrapper zgodności wstecznej na czas deployu.
select ok(
  (
    select obj_description(
      'public.award_play_logged_points(uuid)'::regprocedure, 'pg_proc'
    ) like 'DEPRECATED%'
  ),
  '7. stare RPC za zapis partii istnieje już tylko jako deprecated shim'
);

-- ---------------------------------------------------------------------------
-- 2. RSVP i głos: wartość, odmowa, brak farmienia
-- ---------------------------------------------------------------------------

insert into public.meetings (
  id, created_by, title, status, starts_at, ends_at
)
values (
  'e0000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  'Wieczór Economy V2',
  'planned',
  now() + interval '7 days',
  now() + interval '7 days 4 hours'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.meeting_availability (meeting_id, user_id, is_available)
values (
  'e0000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000003',
  false
);

select results_eq(
  $$
    select awarded, points
    from public.award_meeting_rsvp_points(
      'e0000000-0000-4000-8000-000000000001'
    )
  $$,
  $$values (true, 2)$$,
  '8. odpowiedź „nie będę” też kwalifikuje się do 2 Renomy'
);

update public.meeting_availability
set is_available = true
where meeting_id = 'e0000000-0000-4000-8000-000000000001'
  and user_id = '10000000-0000-0000-0000-000000000003';

select public.award_meeting_rsvp_points(
  'e0000000-0000-4000-8000-000000000001'
);

reset role;
select is(
  pg_temp.renown(
    '10000000-0000-0000-0000-000000000003',
    'meeting_rsvp',
    'e0000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  '9. zmiana odpowiedzi nie farmi kolejnej Renomy'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$
    select awarded, points
    from public.propose_meeting_game(
      'e0000000-0000-4000-8000-000000000001',
      '30000000-0000-0000-0000-000000000001'
    )
  $$,
  $$values (true, 1)$$,
  '10. pierwszy głos na grę to dokładnie 1 Renoma'
);

select public.set_meeting_game_response(
  'e0000000-0000-4000-8000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  false
);
select public.propose_meeting_game(
  'e0000000-0000-4000-8000-000000000001',
  '30000000-0000-0000-0000-000000000002'
);

reset role;
select is(
  pg_temp.renown(
    '10000000-0000-0000-0000-000000000003',
    'meeting_vote',
    'e0000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  '11. zmiana głosu i kolejne propozycje nie farmią Renomy'
);

-- ---------------------------------------------------------------------------
-- 3. Ocena gry
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.ratings (
  game_id, user_id, overall, replayability, theme, wants_to_play_again
)
values (
  '30000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  6, 6, 6, true
);

select results_eq(
  $$
    select awarded, points
    from public.award_rating_created_points(
      '30000000-0000-0000-0000-000000000002'
    )
  $$,
  $$values (true, 3)$$,
  '12. pierwsza ocena gry to dokładnie 3 Renomy'
);

update public.ratings
set overall = 9
where game_id = '30000000-0000-0000-0000-000000000002'
  and user_id = '10000000-0000-0000-0000-000000000003';

select public.award_rating_created_points(
  '30000000-0000-0000-0000-000000000002'
);

reset role;
select is(
  pg_temp.renown(
    '10000000-0000-0000-0000-000000000003',
    'rating_created',
    '30000000-0000-0000-0000-000000000002'
  ),
  3::bigint,
  '13. edycja oceny nie przyznaje kolejnej Renomy'
);

-- ---------------------------------------------------------------------------
-- 4. Organizacja spotkania — tylko za spotkanie, które się odbyło
-- ---------------------------------------------------------------------------

select is(
  pg_temp.renown(
    '10000000-0000-0000-0000-000000000002',
    'meeting_hosted',
    'e0000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  '14. samo utworzenie spotkania nie daje Renomy'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

-- Spotkanie, które nigdy nie zostanie domknięte.
insert into public.meetings (
  id, created_by, title, status, starts_at, ends_at
)
values (
  'e0000000-0000-4000-8000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  'Wieczór, który się nie odbył',
  'confirmed',
  now() - interval '2 days',
  now() - interval '2 days' + interval '4 hours'
);

select results_eq(
  $$
    select awarded, points
    from public.award_meeting_hosted_points(
      'e0000000-0000-4000-8000-000000000002'
    )
  $$,
  $$values (false, 0)$$,
  '15. potwierdzone, ale niedomknięte spotkanie nie daje Renomy'
);

select is(
  public.complete_meeting('e0000000-0000-4000-8000-000000000001'),
  true,
  '16. organizator domyka spotkanie'
);

reset role;
select is(
  pg_temp.renown(
    '10000000-0000-0000-0000-000000000002',
    'meeting_hosted',
    'e0000000-0000-4000-8000-000000000001'
  ),
  5::bigint,
  '17. odbyte spotkanie daje organizatorowi dokładnie 5 Renomy'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select public.award_meeting_hosted_points(
  'e0000000-0000-4000-8000-000000000001'
);

reset role;
select is(
  pg_temp.renown(
    '10000000-0000-0000-0000-000000000002',
    'meeting_hosted',
    'e0000000-0000-4000-8000-000000000001'
  ),
  5::bigint,
  '18. ponowne naliczenie za to samo spotkanie jest idempotentne'
);

-- ---------------------------------------------------------------------------
-- 5. Renoma za UDZIAŁ w partii
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

insert into t_ids (name, id)
values (
  'quad-play',
  public.create_play_with_participants(
    '30000000-0000-0000-0000-000000000001',
    now() - interval '1 day',
    null,
    90,
    'Czterech przy stole',
    jsonb_build_array(
      jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000002', 'placement', 1, 'is_winner', true),
      jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000003', 'placement', 2, 'is_winner', false),
      jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000004', 'placement', 3, 'is_winner', false),
      jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000005', 'placement', 4, 'is_winner', false)
    )
  )
);

reset role;

select results_eq(
  $$
    select points, count(*)::bigint
    from public.point_events
    where action_type = 'play_participated'
      and related_entity_id = (select id from t_ids where name = 'quad-play')
    group by points
  $$,
  $$values (5, 4::bigint)$$,
  '19. czterech uczestników ukończonej partii to cztery nagrody po 5'
);

select is(
  (
    select coalesce(sum(event.points), 0)::bigint
    from public.point_events as event
    where event.user_id = '10000000-0000-0000-0000-000000000002'
      and event.related_entity_id = (select id from t_ids where name = 'quad-play')
  ),
  5::bigint,
  '20. autor zapisu nie dostaje premii za samą operację w UI'
);

select is(
  (
    select count(*)::bigint
    from public.point_events
    where action_type = 'play_logged'
      and related_entity_id = (select id from t_ids where name = 'quad-play')
  ),
  0::bigint,
  '21. nowa partia nie tworzy już zdarzeń play_logged'
);

-- Solo: domena traktuje partię jednoosobową jak pełnoprawną (odznaka
-- lone_wolf), więc solista też dostaje swoje 5.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
set local role authenticated;

insert into t_ids (name, id)
values (
  'solo-play',
  public.create_play_with_participants(
    '30000000-0000-0000-0000-000000000003',
    now() - interval '2 days',
    null,
    45,
    'Solo',
    jsonb_build_array(
      jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000005', 'placement', 1, 'is_winner', true)
    )
  )
);

reset role;
select is(
  pg_temp.play_renown(
    '10000000-0000-0000-0000-000000000005',
    (select id from t_ids where name = 'solo-play')
  ),
  5::bigint,
  '22. partia solo również daje uczestnikowi 5 Renomy'
);

-- Zmiana składu: wypisany uczestnik traci nagrodę przez kompensatę, dopisany
-- ją dostaje. Obsługuje to silnik recompute, nie osobny mechanizm.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select public.update_play_with_participants(
  p_play_id := (select id from t_ids where name = 'quad-play'),
  p_game_id := '30000000-0000-0000-0000-000000000001',
  p_played_at := now() - interval '1 day',
  p_participants := jsonb_build_array(
    jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000002', 'placement', 1, 'is_winner', true),
    jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000003', 'placement', 2, 'is_winner', false)
  ),
  p_status := 'completed'
);

reset role;
select is(
  pg_temp.play_renown(
    '10000000-0000-0000-0000-000000000004',
    (select id from t_ids where name = 'quad-play')
  ),
  0::bigint,
  '23. wypisany uczestnik dostaje poprawną kompensatę do zera'
);

select is(
  pg_temp.play_renown(
    '10000000-0000-0000-0000-000000000003',
    (select id from t_ids where name = 'quad-play')
  ),
  5::bigint,
  '24. uczestnik, który został w składzie, zachowuje dokładnie 5'
);

-- Ponowna finalizacja tego samego wyniku nie może dopisać ani grosza.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select public.update_play_with_participants(
  p_play_id := (select id from t_ids where name = 'quad-play'),
  p_game_id := '30000000-0000-0000-0000-000000000001',
  p_played_at := now() - interval '1 day',
  p_participants := jsonb_build_array(
    jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000002', 'placement', 1, 'is_winner', true),
    jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000003', 'placement', 2, 'is_winner', false)
  ),
  p_status := 'completed'
);

reset role;
select is(
  pg_temp.play_renown(
    '10000000-0000-0000-0000-000000000003',
    (select id from t_ids where name = 'quad-play')
  ),
  5::bigint,
  '25. retry finalizacji nie duplikuje nagrody'
);

-- Cofnięcie do 'in_progress' zabiera nagrodę wszystkim, ponowne ukończenie
-- oddaje ją dokładnie raz — bez ekonomicznego duplikatu.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select public.update_play_with_participants(
  p_play_id := (select id from t_ids where name = 'quad-play'),
  p_game_id := '30000000-0000-0000-0000-000000000001',
  p_played_at := now() - interval '1 day',
  p_participants := jsonb_build_array(
    jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000002', 'placement', 1, 'is_winner', true),
    jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000003', 'placement', 2, 'is_winner', false)
  ),
  p_status := 'in_progress',
  p_state_note := 'Wynik do potwierdzenia'
);

reset role;
select is(
  pg_temp.play_renown(
    '10000000-0000-0000-0000-000000000003',
    (select id from t_ids where name = 'quad-play')
  ),
  0::bigint,
  '26. cofnięcie ukończenia kompensuje nagrodę do zera'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select public.update_play_with_participants(
  p_play_id := (select id from t_ids where name = 'quad-play'),
  p_game_id := '30000000-0000-0000-0000-000000000001',
  p_played_at := now() - interval '1 day',
  p_participants := jsonb_build_array(
    jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000002', 'placement', 1, 'is_winner', true),
    jsonb_build_object('user_id', '10000000-0000-0000-0000-000000000003', 'placement', 2, 'is_winner', false)
  ),
  p_status := 'completed'
);

reset role;
select is(
  pg_temp.play_renown(
    '10000000-0000-0000-0000-000000000003',
    (select id from t_ids where name = 'quad-play')
  ),
  5::bigint,
  '27. ponowne ukończenie oddaje dokładnie 5, bez duplikatu'
);

-- Księga zostaje append-only mimo wszystkich powyższych korekt.
select throws_ok(
  $$
    update public.point_events
    set points = 999
    where action_type = 'play_participated'
  $$,
  '42501',
  null,
  '28. korekty Economy V2 nie łamią append-only księgi'
);

-- ---------------------------------------------------------------------------
-- 6. Stan sprzed Economy V2
-- ---------------------------------------------------------------------------
--
-- Odtwarzamy historię tak, jak wyglądała naprawdę:
--   * partia zapisana przed silnikiem nagród (rewards_managed = FALSE),
--     ukończona, z dwoma prawdziwymi uczestnikami — czyli dokładnie ten
--     przypadek, który poprzednia implementacja pomijała,
--   * 40 Renomy WYŁĄCZNIE dla autora wpisu, drugi uczestnik z zerem,
--   * RSVP wycenione po staremu,
--   * 25 Renomy za samo utworzenie spotkania (`meeting_created`).
--
-- Świadomie bez DELETE na point_events: księga jest append-only także dla
-- superusera, a test ma działać na prawdziwym kształcie danych.

insert into public.plays (
  id, game_id, created_by, played_at, duration_minutes,
  comment, status, state_note, rewards_managed
)
values
  (
    'e1000000-0000-4000-8000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000005',
    now() - interval '30 days',
    120,
    'Partia z ery Economy V1',
    'completed',
    null,
    false
  ),
  -- Partia, która NIE kwalifikuje się do nagrody i nigdy nie może jej dostać:
  -- wieczór nadal trwa albo czeka na wynik.
  (
    'e1000000-0000-4000-8000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000005',
    now() - interval '1 hour',
    null,
    'Partia bez rozliczonego wyniku',
    'in_progress',
    'Odłożona do dokończenia',
    false
  );

insert into public.play_participants (play_id, user_id, placement, is_winner)
values
  ('e1000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000005', 1, true),
  ('e1000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000004', 2, false),
  ('e1000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000005', null, false);

insert into public.point_events (
  user_id, points, action_type, description,
  related_entity_type, related_entity_id, created_by
)
values
  (
    '10000000-0000-0000-0000-000000000005', 40, 'play_logged',
    'Zapis partii w Kronice', 'play',
    'e1000000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000005'
  ),
  (
    '10000000-0000-0000-0000-000000000005', 10, 'meeting_rsvp',
    'Odpowiedź RSVP na spotkanie', 'meeting',
    'e0000000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000005'
  ),
  (
    '10000000-0000-0000-0000-000000000002', 25, 'meeting_created',
    'Utworzenie spotkania', 'meeting',
    'e0000000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000002'
  );

insert into public.meeting_availability (meeting_id, user_id, is_available)
values (
  'e0000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000005',
  true
);

-- ---------------------------------------------------------------------------
-- 7. PODGLĄD — musi być całkowicie bezpieczny
-- ---------------------------------------------------------------------------

create temporary table t_ledger_before as
select
  count(*)::bigint as event_count,
  coalesce(sum(points), 0)::bigint as total_points
from public.point_events;

-- Podgląd wymaga uprawnień administratora.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

create temporary table t_preview_first as
select * from public.preview_economy_v2_rebase();

create temporary table t_preview_second as
select * from public.preview_economy_v2_rebase();

reset role;

select results_eq(
  $q$
    select count(*)::bigint, coalesce(sum(points), 0)::bigint
    from public.point_events
  $q$,
  $q$select event_count, total_points from t_ledger_before$q$,
  '29. podgląd nie zapisuje ani jednego zdarzenia punktowego'
);

select is_empty(
  $q$
    select version from public.economy_rebase_runs where version = 'economy_v2'
  $q$,
  '30. podgląd nie oznacza Economy V2 jako wykonanej'
);

select is_empty(
  $q$
    select first_run.user_id
    from t_preview_first as first_run
    full outer join t_preview_second as second_run
      on second_run.user_id = first_run.user_id
    where first_run.balance_before is distinct from second_run.balance_before
      or first_run.projected_balance_after
         is distinct from second_run.projected_balance_after
      or first_run.delta is distinct from second_run.delta
      or first_run.breakdown is distinct from second_run.breakdown
  $q$,
  '31. dwa kolejne podglądy dają identyczny wynik'
);

-- Breakdown nazywa źródła uzgodnione z produktem.
select ok(
  (
    select bool_and(
      preview.breakdown ?| array[
        'meeting_rsvp', 'meeting_vote', 'rating_created', 'meeting_hosted',
        'shelf_milestones', 'play_participated', 'achievements',
        'admin_adjustments', 'other'
      ]
    )
    from t_preview_first as preview
    where preview.breakdown <> '{}'::jsonb
  ),
  '32. podgląd zwraca breakdown w uzgodnionych kubełkach'
);

-- Kubełek partii Kuby jest PROJEKCJĄ: dziś księga pokazuje 45 (40 z creator-
-- only plus 5 za partię solo naliczone przez silnik), a podgląd zapowiada 15
-- (trzy kwalifikujące się partie po 5). Test pilnuje właśnie tej różnicy —
-- gdyby breakdown był migawką stanu bieżącego, obie liczby byłyby równe.
select isnt(
  (
    select (preview.breakdown ->> 'play_participated')::bigint
    from t_preview_first as preview
    where preview.user_id = '10000000-0000-0000-0000-000000000005'
  ),
  coalesce((
    select sum(event.points)::bigint
    from public.point_events as event
    where event.user_id = '10000000-0000-0000-0000-000000000005'
      and event.action_type in ('play_participated', 'play_logged')
  ), 0),
  '33. breakdown podglądu jest projekcją wartości docelowej, nie migawką'
);

-- ---------------------------------------------------------------------------
-- 8. APPLY — ten sam plan, tym razem zapisany
-- ---------------------------------------------------------------------------

select private.apply_economy_v2_rebase();

select is(
  pg_temp.renown(
    '10000000-0000-0000-0000-000000000005',
    'meeting_rsvp',
    'e0000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  '34. rebase sprowadza historyczne RSVP z 10 do 2'
);

-- Sedno rozdziału legacy reward-engine state od kanonicznego stanu partii:
-- partia ma rewards_managed = FALSE, a mimo to OBAJ uczestnicy dostają po 5.
select results_eq(
  $q$
    select
      pg_temp.play_renown(
        '10000000-0000-0000-0000-000000000005',
        'e1000000-0000-4000-8000-000000000001'
      ),
      pg_temp.play_renown(
        '10000000-0000-0000-0000-000000000004',
        'e1000000-0000-4000-8000-000000000001'
      ),
      (
        select rewards_managed
        from public.plays
        where id = 'e1000000-0000-4000-8000-000000000001'
      )
  $q$,
  $q$values (5::bigint, 5::bigint, false)$q$,
  '35. legacy partia z rewards_managed = false nadal nagradza uczestników'
);

-- Kontrprzykład: jedyny powód, dla którego partia NIE dostaje nagrody, to brak
-- rozliczonego wyniku. Nie „legacy” i nie rewards_managed — sam status.
select results_eq(
  $q$
    select
      pg_temp.play_renown(
        '10000000-0000-0000-0000-000000000005',
        'e1000000-0000-4000-8000-000000000002'
      ),
      (
        select status::text
        from public.plays
        where id = 'e1000000-0000-4000-8000-000000000002'
      )
  $q$,
  $q$values (0::bigint, 'in_progress')$q$,
  '36. partia bez rozliczonego wyniku nie nagradza nikogo'
);

-- Historia zostaje: oryginalne 40 Renomy nadal jest w księdze, a korekta to
-- osobny, ujemny wiersz na kolejnej rewizji.
select results_eq(
  $q$
    select action_type, points, reward_revision
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000005'
      and related_entity_id = 'e1000000-0000-4000-8000-000000000001'
    order by reward_revision
  $q$,
  $q$values ('play_logged', 40, 0), ('play_participated', -35, 0)$q$,
  -- Rewizja 0 dla korekty jest poprawna: ta nagroda nie miała jeszcze wiersza
  -- w play_reward_states (partia sprzed silnika), więc apply_reward_delta
  -- wchodzi ścieżką „pierwsze przyznanie” i zalicza istniejące 40 jako
  -- zaliczkę, dopisując wyłącznie różnicę. Saldo rodziny wynosi 5.
  '37. korekta jest zdarzeniem kompensującym, a nie nadpisaniem historii'
);

-- Podgląd musi przewidzieć DOKŁADNIE saldo, które powstało po zastosowaniu.
select is_empty(
  $q$
    select preview.user_id
    from t_preview_first as preview
    where preview.projected_balance_after <> coalesce((
      select sum(event.points)
      from public.point_events as event
      where event.user_id = preview.user_id
    ), 0)
  $q$,
  '38. projected_balance_after z podglądu równa się saldu po APPLY'
);

-- ---------------------------------------------------------------------------
-- 9. meeting_hosted zastępuje meeting_created
-- ---------------------------------------------------------------------------

select results_eq(
  $q$
    select action_type, points, reward_revision
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
      and related_entity_id = 'e0000000-0000-4000-8000-000000000001'
      and action_type in ('meeting_created', 'meeting_hosted')
    order by action_type, reward_revision
  $q$,
  $q$
    values
      ('meeting_created', 25, 0),
      ('meeting_created', -25, 1),
      ('meeting_hosted', 5, 0)
  $q$,
  '39. historyczny meeting_created zostaje audytowalny, ale wart zero'
);

select is(
  (
    select coalesce(sum(points), 0)::bigint
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
      and related_entity_id = 'e0000000-0000-4000-8000-000000000001'
      and action_type in ('meeting_created', 'meeting_hosted')
  ),
  5::bigint,
  '40. za jeden odbyty wieczór organizator ma łącznie dokładnie 5 Renomy'
);

-- ---------------------------------------------------------------------------
-- 10. Powtarzalność
-- ---------------------------------------------------------------------------

create temporary table t_after_first as
select
  membership.user_id,
  coalesce((
    select sum(event.points)
    from public.point_events as event
    where event.user_id = membership.user_id
  ), 0)::bigint as balance,
  (
    select count(*)::bigint
    from public.point_events as event
    where event.user_id = membership.user_id
  ) as event_count
from public.app_members as membership
where membership.is_active;

select private.apply_economy_v2_rebase();

select is_empty(
  $q$
    select snapshot.user_id
    from t_after_first as snapshot
    where snapshot.balance <> coalesce((
        select sum(event.points)
        from public.point_events as event
        where event.user_id = snapshot.user_id
      ), 0)
      or snapshot.event_count <> (
        select count(*)
        from public.point_events as event
        where event.user_id = snapshot.user_id
      )
  $q$,
  '41. drugi APPLY nie zmienia ani salda, ani liczby zdarzeń'
);

select is(
  (select version from public.economy_rebase_runs where version = 'economy_v2'),
  'economy_v2',
  '42. APPLY zostawia jawny znacznik wersji dla przyszłej Economy V3'
);

-- Odznaki zachowują swoje wartości: Economy V2 nie rusza Legendarium.
select is_empty(
  $q$
    select earned.user_id, earned.achievement_key
    from public.user_achievements as earned
    join public.achievement_definitions as definition
      on definition.achievement_key = earned.achievement_key
    where definition.points > 0
      and coalesce((
        select sum(event.points)
        from public.point_events as event
        where event.user_id = earned.user_id
          and event.action_type = 'achievement_unlocked:' || earned.achievement_key
      ), 0) <> definition.points
  $q$,
  '43. zdobyte odznaki zachowują dokładnie swoje obecne wartości'
);


-- ---------------------------------------------------------------------------
-- 11. Uprawnienia administracyjne ≠ konto poza grywalizacją
-- ---------------------------------------------------------------------------
--
-- public.admin_change_role pozwala awansować dowolnego członka na admina, więc
-- rola jest przełącznikiem uprawnień, a nie oznaczeniem konta technicznego.
-- Gracz z uprawnieniami musi więc dalej zbierać Renomę. Obserwator — nie.

-- ...0006 jest w seedzie nieaktywnym członkiem. Robimy z niego aktywnego
-- obserwatora, żeby mieć oba przypadki obok siebie.
update public.app_members
set role = 'observer'::public.membership_role, is_active = true
where user_id = '10000000-0000-0000-0000-000000000006';

-- Milestone Półki admin dostał już przy rebase (plan go obejmuje), więc do
-- sprawdzenia ŻYWEJ ścieżki bierzemy nagrodę, której jeszcze nie ma.
select results_eq(
  $q$
    select awarded, points
    from private.award_points_once(
      '10000000-0000-0000-0000-000000000001',
      'meeting_vote',
      'meeting',
      'e0000000-0000-4000-8000-000000000001',
      null,
      null
    )
  $q$,
  $q$values (true, 1)$q$,
  '44. admin będący zwykłym graczem zdobywa Renomę'
);

select is(
  pg_temp.renown(
    '10000000-0000-0000-0000-000000000001',
    'shelf_first_game',
    '10000000-0000-0000-0000-000000000001'
  ),
  10::bigint,
  '44a. rebase objął admina tak samo jak każdego innego gracza'
);

select results_eq(
  $q$
    select awarded, points
    from private.award_points_once(
      '10000000-0000-0000-0000-000000000006',
      'shelf_first_game',
      'profile',
      '10000000-0000-0000-0000-000000000006',
      null,
      null
    )
  $q$,
  $q$values (false, 0)$q$,
  '45. konto obserwatora nadal nie zdobywa Renomy'
);

select results_eq(
  $q$
    select
      private.is_gamification_eligible('10000000-0000-0000-0000-000000000001'),
      private.is_gamification_eligible('10000000-0000-0000-0000-000000000006')
  $q$,
  $q$values (true, false)$q$,
  '46. predykat kwalifikacji rozdziela uprawnienia od wykluczenia z gry'
);

-- ---------------------------------------------------------------------------
-- 12. PODGLĄD i APPLY czytają dokładnie tę samą regułę
-- ---------------------------------------------------------------------------
--
-- Obu kontom dopisujemy identyczną historię sprzed V2: odpowiedź na spotkanie
-- wyceniona po staremu na 10. Plan — jedyne źródło obliczeń dla podglądu i
-- zastosowania — musi wycenić ją na 2 dla admina i na 0 dla obserwatora.

insert into public.meeting_availability (meeting_id, user_id, is_available)
values
  ('e0000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000001', true),
  ('e0000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000006', true);

insert into public.point_events (
  user_id, points, action_type, description,
  related_entity_type, related_entity_id, created_by
)
values
  (
    '10000000-0000-0000-0000-000000000001', 10, 'meeting_rsvp',
    'Odpowiedź RSVP na spotkanie', 'meeting',
    'e0000000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '10000000-0000-0000-0000-000000000006', 10, 'meeting_rsvp',
    'Odpowiedź RSVP na spotkanie', 'meeting',
    'e0000000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000006'
  );

select results_eq(
  $q$
    select user_id, target_points
    from private.economy_v2_reward_plan()
    where action_type = 'meeting_rsvp'
      and entity_id = 'e0000000-0000-4000-8000-000000000001'
      and user_id in (
        '10000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000006'
      )
    order by user_id
  $q$,
  $q$
    values
      ('10000000-0000-0000-0000-000000000001'::uuid, 2),
      ('10000000-0000-0000-0000-000000000006'::uuid, 0)
  $q$,
  '47. plan wycenia admina jak gracza, a obserwatora na zero'
);

-- Ta sama reguła end-to-end: to, co zapowiedział podgląd, ma się wydarzyć.
create temporary table t_preview_eligibility as
select user_id, delta
from (
  select * from public.preview_economy_v2_rebase()
) as preview
where user_id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000006'
);

create temporary table t_balance_before_eligibility as
select
  membership.user_id,
  coalesce((
    select sum(event.points)
    from public.point_events as event
    where event.user_id = membership.user_id
  ), 0)::bigint as balance
from public.app_members as membership
where membership.user_id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000006'
);

select private.apply_economy_v2_rebase();

select is_empty(
  $q$
    select snapshot.user_id
    from t_balance_before_eligibility as snapshot
    join t_preview_eligibility as preview
      on preview.user_id = snapshot.user_id
    where snapshot.balance + preview.delta <> coalesce((
      select sum(event.points)
      from public.point_events as event
      where event.user_id = snapshot.user_id
    ), 0)
  $q$,
  '48. PODGLĄD i APPLY dają ten sam wynik dla admina i obserwatora'
);

select is(
  pg_temp.renown(
    '10000000-0000-0000-0000-000000000006',
    'meeting_rsvp',
    'e0000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  '49. historyczna Renoma obserwatora zostaje wyzerowana, nie przeliczona na 2'
);

-- ---------------------------------------------------------------------------
-- 13. Zgodność wsteczna RPC na czas deployu
-- ---------------------------------------------------------------------------
--
-- Wdrożona (stara) wersja frontu woła award_meeting_created_points po KAŻDYM
-- utworzeniu spotkania. Wrapper nie może ani wywrócić requestu, ani przyznać
-- dawnych 25 Renomy.

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.meetings (
  id, created_by, title, status, starts_at, ends_at
)
values
  (
    'e2000000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'Świeżo utworzone spotkanie',
    'planned',
    now() + interval '10 days',
    now() + interval '10 days 4 hours'
  ),
  (
    'e2000000-0000-4000-8000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    'Wieczór, który się odbył',
    'completed',
    now() - interval '3 days',
    now() - interval '3 days' + interval '4 hours'
  );

select results_eq(
  $q$
    select awarded, points
    from public.award_meeting_created_points(
      'e2000000-0000-4000-8000-000000000001'
    )
  $q$,
  $q$values (false, 0)$q$,
  '50. stary klient nie dostaje błędu przy tworzeniu spotkania'
);

select results_eq(
  $q$
    select awarded, points
    from public.award_meeting_created_points(
      'e2000000-0000-4000-8000-000000000002'
    )
  $q$,
  $q$values (true, 5)$q$,
  '51. wrapper deleguje na meeting_hosted, gdy spotkanie faktycznie się odbyło'
);

reset role;

select is(
  (
    select count(*)::bigint
    from public.point_events
    where action_type = 'meeting_created'
      and related_entity_id in (
        'e2000000-0000-4000-8000-000000000001',
        'e2000000-0000-4000-8000-000000000002'
      )
  ),
  0::bigint,
  '52. wrapper nie zapisuje ani jednego nowego zdarzenia meeting_created'
);

-- Stary klient mógłby też zawołać RPC za zapis partii. Wrapper przekierowuje
-- na idempotentne przeliczenie udziału i nie przyznaje dawnych 40 autorowi.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $q$
    select awarded, points, point_event_id
    from public.award_play_logged_points(
      (select id from t_ids where name = 'quad-play')
    )
  $q$,
  $q$values (false, 0, null::uuid)$q$,
  '53. stare RPC za zapis partii nie przyznaje już nic wołającemu'
);

reset role;

select results_eq(
  $q$
    select
      (
        select count(*)::bigint
        from public.point_events
        where action_type = 'play_logged'
          and related_entity_id = (select id from t_ids where name = 'quad-play')
      ),
      pg_temp.play_renown(
        '10000000-0000-0000-0000-000000000002',
        (select id from t_ids where name = 'quad-play')
      )
  $q$,
  $q$values (0::bigint, 5::bigint)$q$,
  '54. po starym RPC nadal zero play_logged, a uczestnik ma dokładnie 5'
);

reset role;
select * from finish();
rollback;
