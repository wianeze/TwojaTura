begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

-- Fixture'y seed.sql: Marta = aktywny member.
-- Wszystkie mutacje domenowe zostają w bazie; po terminie odpada wyłącznie
-- punkt_event. Asercje wykonujemy jako superuser, żeby RLS nie fałszował wyniku.

insert into public.games (id, title, owner_id, status)
values
  (
    '26000000-0000-4000-8000-000000000001',
    'QA wygasła ocena',
    '10000000-0000-0000-0000-000000000002',
    'available'
  ),
  (
    '26000000-0000-4000-8000-000000000002',
    'QA świeża ocena',
    '10000000-0000-0000-0000-000000000002',
    'available'
  );

insert into public.meetings (
  id, created_by, title, status, starts_at, ends_at
)
values
  (
    '26000000-0000-4000-8000-000000000011',
    '10000000-0000-0000-0000-000000000002',
    'Spotkanie wygasłe',
    'completed',
    statement_timestamp() - interval '5 days',
    statement_timestamp() - interval '5 days' + interval '4 hours'
  ),
  (
    '26000000-0000-4000-8000-000000000012',
    '10000000-0000-0000-0000-000000000002',
    'Spotkanie przyszłe',
    'planned',
    statement_timestamp() + interval '1 day',
    statement_timestamp() + interval '1 day 4 hours'
  ),
  (
    '26000000-0000-4000-8000-000000000013',
    '10000000-0000-0000-0000-000000000002',
    'Spotkanie świeżo zakończone',
    'completed',
    statement_timestamp() - interval '1 day 4 hours',
    statement_timestamp() - interval '1 day'
  );

insert into public.meeting_availability (
  meeting_id, user_id, is_available
)
values
  (
    '26000000-0000-4000-8000-000000000011',
    '10000000-0000-0000-0000-000000000002',
    true
  ),
  (
    '26000000-0000-4000-8000-000000000012',
    '10000000-0000-0000-0000-000000000002',
    true
  );

insert into public.meeting_game_proposals (
  meeting_id, game_id, proposed_by
)
values (
  '26000000-0000-4000-8000-000000000011',
  '26000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000002'
);

insert into public.meeting_game_responses (
  meeting_id, game_id, user_id, wants_to_play
)
values (
  '26000000-0000-4000-8000-000000000011',
  '26000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$
    select awarded, points
    from public.award_meeting_rsvp_points(
      '26000000-0000-4000-8000-000000000011'
    )
  $$,
  $$values (false, 0)$$,
  '1. RSVP zapisane po starcie działa, ale nie daje wygasłej nagrody'
);

select results_eq(
  $$
    select awarded, points
    from public.award_meeting_vote_points(
      '26000000-0000-4000-8000-000000000011'
    )
  $$,
  $$values (false, 0)$$,
  '2. odpowiedź na grę po starcie działa, ale nie daje wygasłej nagrody'
);

select results_eq(
  $$
    select awarded, points
    from public.award_meeting_rsvp_points(
      '26000000-0000-4000-8000-000000000012'
    )
  $$,
  $$values (true, 2)$$,
  '3. RSVP przed startem nadal przyznaje Economy V2'
);

reset role;

select is(
  (
    select count(*)
    from public.meeting_availability
    where meeting_id = '26000000-0000-4000-8000-000000000011'
      and user_id = '10000000-0000-0000-0000-000000000002'
  ),
  1::bigint,
  '4. wygasły deadline nie cofa ani nie blokuje samej odpowiedzi RSVP'
);

select is(
  (
    select count(*)
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
      and related_entity_id = '26000000-0000-4000-8000-000000000011'
      and action_type in ('meeting_rsvp', 'meeting_vote')
  ),
  0::bigint,
  '5. wygasłe zlecenia spotkaniowe nie tworzą point_events'
);

insert into public.plays (
  id, game_id, created_by, played_at, status
)
values
  (
    '26000000-0000-4000-8000-000000000021',
    '26000000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    statement_timestamp() - interval '8 days',
    'completed'
  ),
  (
    '26000000-0000-4000-8000-000000000022',
    '26000000-0000-4000-8000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    statement_timestamp() - interval '1 day',
    'completed'
  );

insert into public.play_participants (play_id, user_id, placement, is_winner)
values
  (
    '26000000-0000-4000-8000-000000000021',
    '10000000-0000-0000-0000-000000000002',
    1,
    true
  ),
  (
    '26000000-0000-4000-8000-000000000022',
    '10000000-0000-0000-0000-000000000002',
    1,
    true
  );

insert into public.ratings (
  game_id, user_id, overall, replayability, theme, wants_to_play_again
)
values
  (
    '26000000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    8, 8, 8, true
  ),
  (
    '26000000-0000-4000-8000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    8, 8, 8, true
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$
    select awarded, points
    from public.award_rating_created_points(
      '26000000-0000-4000-8000-000000000001'
    )
  $$,
  $$values (false, 0)$$,
  '6. ocena po 7 dniach zapisuje się bez wygasłej nagrody'
);

select results_eq(
  $$
    select awarded, points
    from public.award_rating_created_points(
      '26000000-0000-4000-8000-000000000002'
    )
  $$,
  $$values (true, 3)$$,
  '7. ocena przed upływem 7 dni nadal przyznaje 3 Renomy'
);

reset role;

select is(
  (
    select count(*)
    from public.ratings
    where game_id = '26000000-0000-4000-8000-000000000001'
      and user_id = '10000000-0000-0000-0000-000000000002'
  ),
  1::bigint,
  '8. wygasły deadline nie blokuje biznesowej akcji oceny'
);

-- Wpis utworzony podczas spotkania, ale rozliczony dopiero pięć dni później:
-- Zlecenie „dodaj wpis” jest już zamknięte, lecz 7-dniowe rozliczenie nadal
-- jest terminowe.
insert into public.plays (
  id, game_id, meeting_id, created_by, played_at, status, created_at, updated_at
) values (
  '26000000-0000-4000-8000-000000000025',
  '26000000-0000-4000-8000-000000000001',
  '26000000-0000-4000-8000-000000000011',
  '10000000-0000-0000-0000-000000000002',
  statement_timestamp() - interval '5 days',
  'completed',
  statement_timestamp() - interval '5 days' + interval '4 hours',
  statement_timestamp()
);

insert into public.play_participants (play_id, user_id, placement, is_winner)
values (
  '26000000-0000-4000-8000-000000000025',
  '10000000-0000-0000-0000-000000000002',
  1,
  true
);

insert into public.plays (
  id, game_id, meeting_id, created_by, played_at, status
)
values
  (
    '26000000-0000-4000-8000-000000000023',
    '26000000-0000-4000-8000-000000000001',
    '26000000-0000-4000-8000-000000000011',
    '10000000-0000-0000-0000-000000000002',
    statement_timestamp() - interval '5 days',
    'completed'
  ),
  (
    '26000000-0000-4000-8000-000000000024',
    '26000000-0000-4000-8000-000000000002',
    '26000000-0000-4000-8000-000000000013',
    '10000000-0000-0000-0000-000000000002',
    statement_timestamp() - interval '1 day',
    'completed'
  );

insert into public.play_participants (play_id, user_id, placement, is_winner)
values
  (
    '26000000-0000-4000-8000-000000000023',
    '10000000-0000-0000-0000-000000000002',
    1,
    true
  ),
  (
    '26000000-0000-4000-8000-000000000024',
    '10000000-0000-0000-0000-000000000002',
    1,
    true
  );

select private.recompute_play_rewards(
  array['10000000-0000-0000-0000-000000000002'::uuid],
  '26000000-0000-4000-8000-000000000023',
  'Test wygasłego Zlecenia Kroniki'
);

select is(
  (
    select count(*)
    from public.plays
    where id = '26000000-0000-4000-8000-000000000023'
  ),
  1::bigint,
  '9. wpis Kroniki po 72h nadal powstaje'
);

select is(
  (
    select coalesce(sum(points), 0)
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
      and related_entity_id = '26000000-0000-4000-8000-000000000023'
      and action_type = 'play_participated'
  ),
  0::bigint,
  '10. wpis Kroniki po 72h nie przyznaje nagrody za wygasłe Zlecenie'
);

select private.recompute_play_rewards(
  array['10000000-0000-0000-0000-000000000002'::uuid],
  '26000000-0000-4000-8000-000000000025',
  'Test siedmiodniowego rozliczenia wyniku'
);

select is(
  (
    select coalesce(sum(points), 0)
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
      and related_entity_id = '26000000-0000-4000-8000-000000000025'
      and action_type = 'play_participated'
  ),
  5::bigint,
  '11. istniejąca partia rozliczona w ciągu 7 dni nadal daje nagrodę'
);

select private.recompute_play_rewards(
  array['10000000-0000-0000-0000-000000000002'::uuid],
  '26000000-0000-4000-8000-000000000024',
  'Test świeżego Zlecenia Kroniki'
);

select is(
  (
    select coalesce(sum(points), 0)
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
      and related_entity_id = '26000000-0000-4000-8000-000000000024'
      and action_type = 'play_participated'
  ),
  5::bigint,
  '12. wpis Kroniki przed upływem 72h nadal przyznaje 5 Renomy'
);

select private.recompute_play_rewards(
  array['10000000-0000-0000-0000-000000000002'::uuid],
  '26000000-0000-4000-8000-000000000024',
  'Ponowny test idempotencji'
);

select is(
  (
    select coalesce(sum(points), 0)
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
      and related_entity_id = '26000000-0000-4000-8000-000000000024'
      and action_type = 'play_participated'
  ),
  5::bigint,
  '13. deadline nie narusza idempotencji nagrody'
);

select is(
  (
    select count(*)
    from private.economy_v2_reward_plan() as plan
    where plan.user_id = '10000000-0000-0000-0000-000000000002'
      and plan.reward_kind = 'play'
      and plan.entity_id = '26000000-0000-4000-8000-000000000023'
      and plan.target_points > 0
  ),
  0::bigint,
  '14. preview Economy V2 nie obiecuje nagrody za wygasłe Zlecenie'
);

select * from finish();
rollback;
