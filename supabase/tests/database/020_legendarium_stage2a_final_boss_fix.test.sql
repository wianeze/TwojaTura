begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

-- Używamy osobnego aktywnego gracza bez wcześniejszej historii partii.
update public.app_members
set is_active = true, role = 'member'
where user_id = '10000000-0000-0000-0000-000000000006';

insert into public.games (id, title, owner_id, release_year, bgg_weight)
values
  ('e9300000-0000-4000-8000-000000000001', 'Final Boss A', '10000000-0000-0000-0000-000000000006', 2024, 4.50),
  ('e9300000-0000-4000-8000-000000000002', 'Final Boss B', '10000000-0000-0000-0000-000000000006', 2024, 4.20),
  ('e9300000-0000-4000-8000-000000000003', 'Final Boss C', '10000000-0000-0000-0000-000000000006', 2024, 4.00);

-- Pierwsza partia jest ciężką wygraną kooperacyjną: spełnia Boss Defeated,
-- ale stanowi dopiero 1/3 różnych gier wymaganych przez Final Boss.
insert into public.plays (
  id, game_id, created_by, played_at, created_at, status, mode, team_result
)
values (
  'e9310000-0000-4000-8000-000000000001',
  'e9300000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000006',
  '2026-01-01', '2026-01-01', 'completed', 'cooperative', 'win'
);

insert into public.play_participants (play_id, user_id, placement, is_winner)
values (
  'e9310000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000006',
  null,
  true
);

select ok(
  not private.qualifies_for_achievement(
    '10000000-0000-0000-0000-000000000006', 'final_boss'
  ),
  '1. jedna wygrana gra o weight 4.5 nie odblokowuje Final Boss'
);

select ok(
  private.qualifies_for_achievement(
    '10000000-0000-0000-0000-000000000006', 'boss_defeated'
  ),
  '2. ta sama partia spełnia niezmieniony warunek Boss Defeated'
);

-- Dwie kolejne wygrane tej samej gry nie zwiększają liczby różnych tytułów.
insert into public.plays (
  id, game_id, created_by, played_at, created_at, status, mode
)
values
  ('e9310000-0000-4000-8000-000000000002', 'e9300000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000006', '2026-01-02', '2026-01-02', 'completed', 'competitive'),
  ('e9310000-0000-4000-8000-000000000003', 'e9300000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000006', '2026-01-03', '2026-01-03', 'completed', 'competitive');

insert into public.play_participants (play_id, user_id, placement, is_winner)
values
  ('e9310000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000006', 1, true),
  ('e9310000-0000-4000-8000-000000000003', '10000000-0000-0000-0000-000000000006', 1, true);

select ok(
  not private.qualifies_for_achievement(
    '10000000-0000-0000-0000-000000000006', 'final_boss'
  ),
  '3. trzy wygrane partie tej samej ciężkiej gry nadal nie wystarczają'
);

-- Drugi różny ciężki tytuł nadal pozostawia progres na 2/3.
insert into public.plays (
  id, game_id, created_by, played_at, created_at, status, mode
)
values (
  'e9310000-0000-4000-8000-000000000004',
  'e9300000-0000-4000-8000-000000000002',
  '10000000-0000-0000-0000-000000000006',
  '2026-01-04', '2026-01-04', 'completed', 'competitive'
);

insert into public.play_participants (play_id, user_id, placement, is_winner)
values (
  'e9310000-0000-4000-8000-000000000004',
  '10000000-0000-0000-0000-000000000006',
  1,
  true
);

select ok(
  not private.qualifies_for_achievement(
    '10000000-0000-0000-0000-000000000006', 'final_boss'
  ),
  '4. dwie różne wygrane gry o weight >= 4.0 nie wystarczają'
);

-- Nieukończona trzecia gra nie może wypełnić warunku.
insert into public.plays (
  id, game_id, created_by, played_at, created_at, status, mode, state_note
)
values (
  'e9310000-0000-4000-8000-000000000005',
  'e9300000-0000-4000-8000-000000000003',
  '10000000-0000-0000-0000-000000000006',
  '2026-01-05', '2026-01-05', 'in_progress', 'competitive',
  'Testowa partia nadal trwa'
);

insert into public.play_participants (play_id, user_id, placement, is_winner)
values (
  'e9310000-0000-4000-8000-000000000005',
  '10000000-0000-0000-0000-000000000006',
  1,
  true
);

select ok(
  not private.qualifies_for_achievement(
    '10000000-0000-0000-0000-000000000006', 'final_boss'
  ),
  '5. nieukończona trzecia gra nie liczy się do Final Boss'
);

update public.plays
set status = 'completed'
where id = 'e9310000-0000-4000-8000-000000000005';

select ok(
  private.qualifies_for_achievement(
    '10000000-0000-0000-0000-000000000006', 'final_boss'
  ),
  '6. zwycięstwa w trzech różnych ukończonych ciężkich grach odblokowują Final Boss'
);

select is(
  (
    select count(distinct play.game_id)
    from public.play_participants as participant
    join public.plays as play on play.id = participant.play_id
    join public.games as game on game.id = play.game_id
    where participant.user_id = '10000000-0000-0000-0000-000000000006'
      and participant.is_winner
      and play.status = 'completed'
      and game.bgg_weight >= 4.0
  ),
  3::bigint,
  '7. kooperacyjna wygrana jest jedną z dokładnie trzech różnych gier'
);

select is(
  (select condition_text from public.achievement_definitions
   where achievement_key = 'final_boss'),
  'Wygraj ukończone partie w 3 różnych grach, z których każda ma trudność BGG co najmniej 4,0.',
  '8. opis Final Boss odpowiada nowemu warunkowi'
);

select ok(
  exists (
    select 1
    from private.legendarium_stage2a_reconciliation_plan() as plan
    where plan.user_id = '10000000-0000-0000-0000-000000000006'
      and plan.achievement_key = 'final_boss'
      and not plan.current_unlocked
      and plan.target_unlocked
  ),
  '9. read-only reconciliation proponuje historyczny unlock Final Boss'
);

select is(
  (select count(*) from public.user_achievements
   where user_id = '10000000-0000-0000-0000-000000000006'
     and achievement_key = 'final_boss'),
  0::bigint,
  '10. sam preview nie zapisuje odznaki'
);

select ok(
  private.recompute_legendarium_stage2a_achievements(
    array['10000000-0000-0000-0000-000000000006'::uuid],
    null,
    'test_final_boss_fix_backfill'
  ) > 0,
  '11. kontrolowany lokalny backfill przyznaje kwalifikujący unlock'
);

select is(
  private.recompute_legendarium_stage2a_achievements(
    array['10000000-0000-0000-0000-000000000006'::uuid],
    null,
    'test_final_boss_fix_repeat'
  ),
  0,
  '12. drugi recompute jest idempotentny'
);

select results_eq(
  $$
    select
      count(*)::bigint,
      count(event.id)::bigint
    from public.user_achievements as earned
    left join public.point_events as event
      on event.user_id = earned.user_id
     and event.action_type = 'achievement_unlocked:' || earned.achievement_key
     and event.related_entity_type = 'profile'
     and event.related_entity_id = earned.user_id
    where earned.user_id = '10000000-0000-0000-0000-000000000006'
      and earned.achievement_key = 'final_boss'
  $$,
  $$values (1::bigint, 1::bigint)$$,
  '13. ponowny recompute nie dubluje odznaki ani zdarzenia Renomy'
);

select * from finish();
rollback;
