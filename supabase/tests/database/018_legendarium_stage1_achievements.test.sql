begin;

create extension if not exists pgtap with schema extensions;
select plan(33);

-- Wszystkie fixture'y żyją wyłącznie w transakcji testu.
insert into public.games (id, title, owner_id)
values
  ('e8100000-0000-4000-8000-000000000001', 'Legendarium test A', '10000000-0000-0000-0000-000000000002'),
  ('e8100000-0000-4000-8000-000000000002', 'Legendarium test B', '10000000-0000-0000-0000-000000000003');

-- 1–4. Statusy i katalog.
select results_eq(
  $$
    select achievement_key, automation_status
    from public.achievement_definitions
    where achievement_key in (
      'natural_one', 'dark_urge', 'party_summoned',
      'persuasion_master', 'quest_accepted'
    )
    order by achievement_key
  $$,
  $$
    values
      ('dark_urge', 'automatic'),
      ('natural_one', 'automatic'),
      ('party_summoned', 'automatic'),
      ('persuasion_master', 'automatic'),
      ('quest_accepted', 'automatic')
  $$,
  '1. naprawione achievementy mają prawdziwy status automatic'
);

select is(
  (select count(*) from public.achievement_definitions where points = 5 and rarity = 'common'),
  (select count(*) from public.achievement_definitions where rarity = 'common'),
  '2. wszystkie Common są warte 5 Renomy'
);

select results_eq(
  $$
    select rarity, min(points), max(points)
    from public.achievement_definitions
    where rarity in ('rare', 'epic', 'legendary')
    group by rarity
    order by rarity
  $$,
  $$values ('epic', 20, 20), ('legendary', 35, 35), ('rare', 10, 10)$$,
  '3. Rare/Epic/Legendary używają skali 10/20/35'
);

select results_eq(
  $$
    select achievement_key, automation_status
    from public.achievement_definitions
    where achievement_key in (
      'redemption_arc', 'chosen_of_the_table', 'dice_speak', 'hot_streak'
    )
    order by achievement_key
  $$,
  $$
    values
      ('chosen_of_the_table', 'planned'),
      ('dice_speak', 'secret'),
      ('hot_streak', 'secret'),
      ('redemption_arc', 'automatic')
  $$,
  '4. Stage 2B aktywuje Redemption Arc, a pozostałe badge zachowują planned/secret'
);

-- 5–10. Zwołanie Drużyny: komplet eligibility, admin, observer i inactive.
insert into public.meetings (
  id, created_by, title, status, starts_at, ends_at
)
values (
  'e8110000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  'Pełna drużyna', 'completed', now() - interval '2 hours', now() - interval '1 hour'
);

insert into public.plays (
  id, game_id, meeting_id, created_by, played_at, status, mode, team_result
)
values (
  'e8120000-0000-4000-8000-000000000001',
  'e8100000-0000-4000-8000-000000000001',
  'e8110000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  now() - interval '90 minutes', 'completed', 'cooperative', 'win'
);

-- Najpierw brakuje admina i jednego membera.
insert into public.play_participants (play_id, user_id, is_winner)
values
  ('e8120000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000002', true),
  ('e8120000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000003', true),
  ('e8120000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000004', true);

select ok(
  not private.meeting_has_full_eligible_party('e8110000-0000-4000-8000-000000000001'),
  '5. brak jednego aktywnego gracza blokuje komplet'
);

insert into public.play_participants (play_id, user_id, is_winner)
values ('e8120000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000005', true);

select ok(
  not private.meeting_has_full_eligible_party('e8110000-0000-4000-8000-000000000001'),
  '6. aktywny admin jest normalnie liczony przez eligibility'
);

insert into public.play_participants (play_id, user_id, is_winner)
values ('e8120000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000001', true);

select ok(
  private.meeting_has_full_eligible_party('e8110000-0000-4000-8000-000000000001'),
  '7. komplet aktywnych graczy wraz z adminem kwalifikuje spotkanie'
);

select ok(
  private.qualifies_for_achievement('10000000-0000-0000-0000-000000000002', 'party_summoned'),
  '8. organizator pełnego spotkania spełnia party_summoned'
);

update public.app_members
set role = 'observer', is_active = true
where user_id = '10000000-0000-0000-0000-000000000005';
delete from public.play_participants
where play_id = 'e8120000-0000-4000-8000-000000000001'
  and user_id = '10000000-0000-0000-0000-000000000005';

select ok(
  private.meeting_has_full_eligible_party('e8110000-0000-4000-8000-000000000001'),
  '9. observer nie blokuje kompletu, podobnie jak nieaktywny użytkownik'
);

update public.meetings set status = 'confirmed'
where id = 'e8110000-0000-4000-8000-000000000001';

select ok(
  not private.meeting_has_full_eligible_party('e8110000-0000-4000-8000-000000000001'),
  '10. niedokończone spotkanie nie liczy się do party_summoned'
);

update public.meetings
set status = 'completed',
    deleted_at = now(),
    deleted_by = '10000000-0000-0000-0000-000000000001'
where id = 'e8110000-0000-4000-8000-000000000001';

select ok(
  not private.meeting_has_full_eligible_party('e8110000-0000-4000-8000-000000000001'),
  '11. usunięte spotkanie nie liczy się do party_summoned'
);

update public.meetings
set deleted_at = null, deleted_by = null, deleted_reason = null
where id = 'e8110000-0000-4000-8000-000000000001';

-- 12–13. Mistrz Inicjatywy liczy wyłącznie ukończone spotkania.
insert into public.meetings (
  id, created_by, title, status, starts_at, ends_at
)
select
  ('e8130000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  '10000000-0000-0000-0000-000000000004',
  'Ukończone ' || series,
  'completed',
  now() - series * interval '1 day',
  now() - series * interval '1 day' + interval '3 hours'
from generate_series(1, 5) as series;

insert into public.meetings (
  id, created_by, title, status, starts_at, ends_at
)
select
  ('e8140000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  '10000000-0000-0000-0000-000000000005',
  'Tylko utworzone ' || series,
  'planned',
  now() + series * interval '1 day',
  now() + series * interval '1 day' + interval '3 hours'
from generate_series(1, 5) as series;

select ok(
  private.qualifies_for_achievement('10000000-0000-0000-0000-000000000004', 'initiative_master'),
  '12. pięć ukończonych spotkań odblokowuje initiative_master'
);

select ok(
  not private.qualifies_for_achievement('10000000-0000-0000-0000-000000000005', 'initiative_master'),
  '13. pięć samych utworzonych spotkań nie wystarcza'
);

-- Przywracamy Kubę do zwykłego membera dla dalszych scenariuszy.
update public.app_members
set role = 'member', is_active = true
where user_id = '10000000-0000-0000-0000-000000000005';

-- 14–16. Side Quest należy do uczestników, nie autora logu.
insert into public.plays (
  id, game_id, meeting_id, created_by, played_at, status, mode, team_result
)
values (
  'e8150000-0000-4000-8000-000000000001',
  'e8100000-0000-4000-8000-000000000001',
  null,
  '10000000-0000-0000-0000-000000000002',
  now(), 'completed', 'cooperative', 'win'
);
insert into public.play_participants (play_id, user_id, is_winner)
values
  ('e8150000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000003', true),
  ('e8150000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000004', true);

select ok(
  private.qualifies_for_achievement('10000000-0000-0000-0000-000000000003', 'side_quest'),
  '14. pierwszy faktyczny uczestnik dostaje Side Quest'
);
select ok(
  private.qualifies_for_achievement('10000000-0000-0000-0000-000000000004', 'side_quest'),
  '15. każdy faktyczny uczestnik dostaje Side Quest'
);
select ok(
  not private.qualifies_for_achievement('10000000-0000-0000-0000-000000000002', 'side_quest'),
  '16. sam autor wpisu bez uczestnictwa nie dostaje Side Quest'
);

-- 17–20. Mistrz Perswazji: dokładna para spotkanie/gra, liczona raz.
insert into public.meetings (id, created_by, title, status, starts_at, ends_at)
select
  ('e8160000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  '10000000-0000-0000-0000-000000000002',
  'Perswazja ' || series, 'completed',
  now() - series * interval '2 days',
  now() - series * interval '2 days' + interval '3 hours'
from generate_series(1, 10) as series;

insert into public.meeting_game_proposals (meeting_id, game_id, proposed_by)
select
  ('e8160000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  'e8100000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000002'
from generate_series(1, 10) as series;

insert into public.meeting_game_responses (meeting_id, game_id, user_id, wants_to_play)
select
  ('e8160000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  'e8100000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000002', true
from generate_series(1, 10) as series;

insert into public.plays (id, game_id, meeting_id, created_by, played_at, status)
select
  ('e8170000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  'e8100000-0000-4000-8000-000000000001',
  ('e8160000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  '10000000-0000-0000-0000-000000000002',
  now() - series * interval '2 days', 'completed'
from generate_series(1, 10) as series;

select ok(
  private.qualifies_for_achievement('10000000-0000-0000-0000-000000000002', 'persuasion_master'),
  '17. dziesięć głosów na później rozegraną grę odblokowuje Mistrza Perswazji'
);

select ok(
  not private.qualifies_for_achievement('10000000-0000-0000-0000-000000000003', 'persuasion_master'),
  '18. brak właściwego głosu nie liczy rozegranej gry'
);

insert into public.meeting_game_proposals (meeting_id, game_id, proposed_by)
values (
  'e8160000-0000-4000-8000-000000000001',
  'e8100000-0000-4000-8000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);
insert into public.meeting_game_responses (meeting_id, game_id, user_id, wants_to_play)
values (
  'e8160000-0000-4000-8000-000000000001',
  'e8100000-0000-4000-8000-000000000002',
  '10000000-0000-0000-0000-000000000003', true
);

select ok(
  not private.qualifies_for_achievement('10000000-0000-0000-0000-000000000003', 'persuasion_master'),
  '19. głos na inną, nierozegraną grę nie liczy'
);

select is(
  (
    select count(*)
    from (
      select response.meeting_id, response.game_id
      from public.meeting_game_responses as response
      join public.plays as play
        on play.meeting_id = response.meeting_id
       and play.game_id = response.game_id
       and play.status = 'completed'
      where response.user_id = '10000000-0000-0000-0000-000000000002'
        and response.wants_to_play
      group by response.meeting_id, response.game_id
    ) as unique_matches
  ),
  10::bigint,
  '20. jedna para spotkanie/gra liczy się tylko raz'
);

-- 21–23. Quest Accepted: TAK + faktyczny udział w tym samym spotkaniu.
insert into public.meeting_availability (meeting_id, user_id, is_available)
select
  ('e8160000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  '10000000-0000-0000-0000-000000000004', true
from generate_series(1, 10) as series;

insert into public.play_participants (play_id, user_id, placement, is_winner)
select
  ('e8170000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  '10000000-0000-0000-0000-000000000004', 1, true
from generate_series(1, 10) as series;

select ok(
  private.qualifies_for_achievement('10000000-0000-0000-0000-000000000004', 'quest_accepted'),
  '21. dziesięć pozytywnych RSVP potwierdzonych udziałem odblokowuje Quest Accepted'
);

insert into public.meeting_availability (meeting_id, user_id, is_available)
select
  ('e8160000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  '10000000-0000-0000-0000-000000000005', true
from generate_series(1, 10) as series;

select ok(
  not private.qualifies_for_achievement('10000000-0000-0000-0000-000000000005', 'quest_accepted'),
  '22. samo RSVP bez faktycznego udziału nie liczy'
);

select ok(
  not private.qualifies_for_achievement('10000000-0000-0000-0000-000000000002', 'quest_accepted'),
  '23. udział bez pozytywnej deklaracji nie liczy'
);

-- 24–28. Backfill i idempotencja.
select ok(
  private.recompute_legendarium_stage1_achievements(null, 'test_backfill') > 0,
  '24. pierwszy recompute przyznaje historycznie spełnione achievementy'
);

select ok(
  exists (
    select 1 from public.user_achievements
    where user_id = '10000000-0000-0000-0000-000000000004'
      and achievement_key = 'quest_accepted'
  ),
  '25. backfill zapisuje Quest Accepted bez ręcznej listy użytkowników'
);

select is(
  private.recompute_legendarium_stage1_achievements(null, 'test_backfill_repeat'),
  0,
  '26. drugi recompute nie tworzy żadnej zmiany'
);

select is(
  (
    select count(*)
    from public.user_achievements
    where user_id = '10000000-0000-0000-0000-000000000004'
      and achievement_key = 'quest_accepted'
  ),
  1::bigint,
  '27. idempotencja utrzymuje jeden unlock'
);

select is(
  (
    select count(*)
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000004'
      and action_type = 'achievement_unlocked:quest_accepted'
  ),
  1::bigint,
  '28. idempotencja utrzymuje jedno zdarzenie Renomy'
);

-- 29–31. Preview i append-only rebalance.
insert into public.user_achievements (
  user_id, achievement_key, awarded_by, source_event_type
)
values (
  '10000000-0000-0000-0000-000000000003',
  'fanboy',
  '10000000-0000-0000-0000-000000000001',
  'legacy_test'
)
on conflict do nothing;

insert into public.point_events (
  user_id, points, action_type, description,
  related_entity_type, related_entity_id, created_by, reward_revision
)
values (
  '10000000-0000-0000-0000-000000000003',
  15,
  'achievement_unlocked:fanboy',
  'Stara wartość Rare',
  'profile',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  0
)
on conflict do nothing;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select * from public.preview_legendarium_stage1_reconciliation()$$,
  '29. administrator może wykonać read-only preview'
);

reset role;

select is(
  private.reward_ledger_net(
    '10000000-0000-0000-0000-000000000003', 'achievement', 'fanboy'
  ),
  15,
  '30. preview nie zmienia historycznej księgi'
);

create temporary table t_stage1_apply_first as
select * from private.apply_legendarium_stage1_reconciliation();
create temporary table t_stage1_apply_second as
select * from private.apply_legendarium_stage1_reconciliation();

select results_eq(
  $$
    select
      private.reward_ledger_net(
        '10000000-0000-0000-0000-000000000003', 'achievement', 'fanboy'
      ),
      count(*)
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000003'
      and action_type = 'achievement_unlocked:fanboy'
  $$,
  $$values (10, 2::bigint)$$,
  '31. APPLY dopisuje jedną kompensatę, a drugi przebieg nie dubluje delta'
);

select is(
  (select count(*) from public.class_definitions where is_active),
  14::bigint,
  '32. wszystkie 14 klas pozostaje aktywne'
);

select ok(
  not exists (
    select 1
    from public.profiles as profile
    join public.class_requirements as requirement
      on requirement.class_key = profile.active_class_key
    left join public.user_achievements as earned
      on earned.user_id = profile.id
     and earned.achievement_key = requirement.achievement_key
    where profile.active_class_key is not null
      and earned.achievement_key is null
  ),
  '33. aktywna klasa nadal wymaga wszystkich faktycznie zdobytych odznak'
);

select * from finish();
rollback;
