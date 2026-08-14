begin;

create extension if not exists pgtap with schema extensions;
select plan(39);

-- Katalog i statusy ---------------------------------------------------------
select is(
  (select count(*) from public.achievement_definitions
   where achievement_key in (
     'candlekeep_sage', 'hot_take', 'glass_cannon', 'git_gud',
     'no_save_found', 'the_absolute', 'critical_success_question_mark',
     'redemption_arc', 'hot_streak'
   ) and automation_status in ('automatic', 'secret') and not is_manual),
  9::bigint,
  '1. dziewięć odznak Stage 2B ma realny status automatyzacji'
);

select is(
  (select count(*) from public.achievement_definitions
   where achievement_key in (
     'bone_breaker', 'table_rogue', 'tavern_brawler', 'multiclass',
     'chosen_of_the_table', 'dice_speak'
   ) and automation_status in ('planned', 'secret')),
  6::bigint,
  '2. badge metadanych, sezonu i losowania pozostają planned/secret'
);

select results_eq(
  $$
    select achievement_key, points
    from public.achievement_definitions
    where achievement_key in (
      'candlekeep_sage', 'hot_take', 'glass_cannon', 'git_gud',
      'no_save_found', 'the_absolute', 'critical_success_question_mark',
      'redemption_arc', 'hot_streak'
    )
    order by achievement_key
  $$,
  $$
    values
      ('candlekeep_sage', 10), ('critical_success_question_mark', 20),
      ('git_gud', 20), ('glass_cannon', 20), ('hot_streak', 20),
      ('hot_take', 10), ('no_save_found', 20), ('redemption_arc', 20),
      ('the_absolute', 35)
  $$,
  '3. Stage 2B zachowuje skalę Renomy rarity'
);

select ok(
  (select condition_text like '%3 kolejnych ostatnich miejsc%'
   from public.achievement_definitions
   where achievement_key = 'redemption_arc'),
  '4. copy Redemption Arc opisuje repurpose'
);

select ok(
  (select condition_text like '%5 kolejnych%'
   from public.achievement_definitions
   where achievement_key = 'hot_streak'),
  '5. copy Hot Streak opisuje serię zwycięstw'
);

-- Candlekeep: uczestnik, nie autor, i granica 10 różnych gier. --------------
insert into public.games (id, title, owner_id, bgg_weight)
select
  md5('stage2b-heavy-game-' || n)::uuid,
  'Stage 2B ciężka gra ' || n,
  '10000000-0000-0000-0000-000000000002',
  case when n = 10 then 3.50 else 4.00 end
from generate_series(1, 10) as n;

insert into public.plays (
  id, game_id, created_by, played_at, created_at, status, mode
)
select
  md5('stage2b-heavy-play-' || n)::uuid,
  md5('stage2b-heavy-game-' || n)::uuid,
  '10000000-0000-0000-0000-000000000002',
  '2020-01-01'::timestamptz + make_interval(days => n),
  '2020-01-01'::timestamptz + make_interval(days => n),
  'completed',
  'competitive'
from generate_series(1, 10) as n;

insert into public.play_participants (play_id, user_id, placement, is_winner)
select md5('stage2b-heavy-play-' || n)::uuid,
       '10000000-0000-0000-0000-000000000001', 1, true
from generate_series(1, 10) as n;

insert into public.play_participants (play_id, user_id, placement, is_winner)
select md5('stage2b-heavy-play-' || n)::uuid,
       '10000000-0000-0000-0000-000000000006', 2, false
from generate_series(1, 9) as n;

select ok(
  private.qualifies_for_achievement(
    '10000000-0000-0000-0000-000000000001', 'candlekeep_sage'
  ),
  '6. Candlekeep: uczestnictwo w 10 różnych grach z weight >= 3.5 kwalifikuje'
);

select ok(
  not private.qualifies_for_achievement(
    '10000000-0000-0000-0000-000000000002', 'candlekeep_sage'
  ),
  '7. Candlekeep: autor dziesięciu logów bez udziału nie kwalifikuje'
);

select ok(
  not private.qualifies_for_achievement(
    '10000000-0000-0000-0000-000000000006', 'candlekeep_sage'
  ),
  '8. Candlekeep: dziewięć różnych gier nie wystarcza'
);

-- Hot Take: forward-only, minimum 3 innych i próg absolutny 4.0. ------------
insert into public.games (id, title, owner_id)
values
  ('b2b00000-0000-4000-8000-000000000011', 'Hot Take dwóch', '10000000-0000-0000-0000-000000000002'),
  ('b2b00000-0000-4000-8000-000000000012', 'Hot Take 3.9', '10000000-0000-0000-0000-000000000002'),
  ('b2b00000-0000-4000-8000-000000000013', 'Hot Take 4.0', '10000000-0000-0000-0000-000000000002');

insert into public.ratings (
  game_id, user_id, overall, replayability, theme, wants_to_play_again
)
values
  ('b2b00000-0000-4000-8000-000000000011', '10000000-0000-0000-0000-000000000003', 6, 6, 6, true),
  ('b2b00000-0000-4000-8000-000000000011', '10000000-0000-0000-0000-000000000004', 6, 6, 6, true),
  ('b2b00000-0000-4000-8000-000000000011', '10000000-0000-0000-0000-000000000002', 10, 10, 10, true);

select ok(
  not exists (select 1 from public.user_achievements
              where user_id = '10000000-0000-0000-0000-000000000002'
                and achievement_key = 'hot_take'),
  '9. Hot Take: dwie inne oceny nie wystarczają'
);

insert into public.ratings (
  game_id, user_id, overall, replayability, theme, wants_to_play_again
)
values
  ('b2b00000-0000-4000-8000-000000000012', '10000000-0000-0000-0000-000000000003', 6, 6, 6, true),
  ('b2b00000-0000-4000-8000-000000000012', '10000000-0000-0000-0000-000000000004', 6, 6, 6, true),
  ('b2b00000-0000-4000-8000-000000000012', '10000000-0000-0000-0000-000000000005', 7, 7, 7, true),
  ('b2b00000-0000-4000-8000-000000000012', '10000000-0000-0000-0000-000000000002', 10, 10, 10, true);

select ok(
  not exists (select 1 from public.user_achievements
              where user_id = '10000000-0000-0000-0000-000000000002'
                and achievement_key = 'hot_take'),
  '10. Hot Take: trzy inne oceny i różnica poniżej 4.0 nie wystarczają'
);

insert into public.ratings (
  game_id, user_id, overall, replayability, theme, wants_to_play_again
)
values
  ('b2b00000-0000-4000-8000-000000000013', '10000000-0000-0000-0000-000000000003', 6, 6, 6, true),
  ('b2b00000-0000-4000-8000-000000000013', '10000000-0000-0000-0000-000000000004', 6, 6, 6, true),
  ('b2b00000-0000-4000-8000-000000000013', '10000000-0000-0000-0000-000000000005', 6, 6, 6, true),
  ('b2b00000-0000-4000-8000-000000000013', '10000000-0000-0000-0000-000000000002', 10, 10, 10, true);

select ok(
  exists (select 1 from public.user_achievements
          where user_id = '10000000-0000-0000-0000-000000000002'
            and achievement_key = 'hot_take'),
  '11. Hot Take: trzy inne oceny i różnica dokładnie 4.0 odblokowują badge'
);

update public.ratings set overall = 10
where game_id = 'b2b00000-0000-4000-8000-000000000013'
  and user_id = '10000000-0000-0000-0000-000000000003';

select ok(
  exists (select 1 from public.user_achievements
          where user_id = '10000000-0000-0000-0000-000000000002'
            and achievement_key = 'hot_take'),
  '12. Hot Take pozostaje sticky po późniejszej zmianie średniej'
);

select is(
  private.reward_ledger_net(
    '10000000-0000-0000-0000-000000000002', 'achievement', 'hot_take'
  ),
  10,
  '13. Hot Take nalicza dokładnie 10 Renomy raz'
);

-- Glass Cannon: pięć realnych rankingów, skrajność first/last. --------------
insert into public.games (id, title, owner_id)
select md5('stage2b-glass-game-' || n)::uuid, 'Glass ' || n,
       '10000000-0000-0000-0000-000000000002'
from generate_series(1, 5) as n;

insert into public.plays (id, game_id, created_by, played_at, created_at, status, mode)
select md5('stage2b-glass-play-' || n)::uuid,
       md5('stage2b-glass-game-' || n)::uuid,
       '10000000-0000-0000-0000-000000000003',
       '2021-01-01'::timestamptz + make_interval(days => n),
       '2021-01-01'::timestamptz + make_interval(days => n),
       'completed', 'competitive'
from generate_series(1, 5) as n;

insert into public.play_participants (play_id, user_id, placement, is_winner)
select md5('stage2b-glass-play-' || n)::uuid,
       '10000000-0000-0000-0000-000000000002'::uuid,
       case when n % 2 = 0 then 1 else 3 end,
       n % 2 = 0
from generate_series(1, 5) as n
union all
select md5('stage2b-glass-play-' || n)::uuid,
       '10000000-0000-0000-0000-000000000003'::uuid, 2, false
from generate_series(1, 5) as n
union all
select md5('stage2b-glass-play-' || n)::uuid,
       '10000000-0000-0000-0000-000000000004'::uuid,
       case when n % 2 = 0 then 3 else 1 end,
       n % 2 <> 0
from generate_series(1, 5) as n;

select ok(private.qualifies_for_achievement(
  '10000000-0000-0000-0000-000000000002', 'glass_cannon'
), '14. Glass Cannon: pięć kolejnych skrajnych miejsc kwalifikuje');

select ok(not private.qualifies_for_achievement(
  '10000000-0000-0000-0000-000000000003', 'glass_cannon'
), '15. Glass Cannon: środkowe miejsce przerywa warunek');

-- Git Gud / Determinacja: sekwencja per user + game. ------------------------
insert into public.games (id, title, owner_id)
values ('b2b00000-0000-4000-8000-000000000021', 'Git Gud',
        '10000000-0000-0000-0000-000000000003');

insert into public.plays (id, game_id, created_by, played_at, created_at, status, mode)
select md5('stage2b-git-play-' || n)::uuid,
       'b2b00000-0000-4000-8000-000000000021',
       '10000000-0000-0000-0000-000000000004',
       '2022-01-01'::timestamptz + make_interval(days => n),
       '2022-01-01'::timestamptz + make_interval(days => n),
       'completed', 'competitive'
from generate_series(1, 4) as n;

insert into public.play_participants (play_id, user_id, placement, is_winner)
select md5('stage2b-git-play-' || n)::uuid,
       '10000000-0000-0000-0000-000000000003'::uuid,
       case when n = 4 then 1 else 2 end, n = 4
from generate_series(1, 4) as n
union all
select md5('stage2b-git-play-' || n)::uuid,
       '10000000-0000-0000-0000-000000000004'::uuid,
       case when n = 4 then 2 else 1 end, n <> 4
from generate_series(1, 4) as n;

select ok(private.qualifies_for_achievement(
  '10000000-0000-0000-0000-000000000003', 'git_gud'
), '16. Git Gud: LLLW tej samej gry kwalifikuje');

select ok(private.qualifies_for_achievement(
  '10000000-0000-0000-0000-000000000003', 'no_save_found'
), '17. Determinacja: LLL plus czwarta partia kwalifikuje niezależnie od wyniku');

select ok(not private.qualifies_for_achievement(
  '10000000-0000-0000-0000-000000000002', 'git_gud'
), '18. Git Gud: porażki i zwycięstwa w różnych grach nie tworzą LLLW per game');

-- Absolutny: minimum 3 kwalifikujących głosujących, jedna gra, zwycięzca. ----
insert into public.games (id, title, owner_id)
values ('b2b00000-0000-4000-8000-000000000031', 'Absolutna gra',
        '10000000-0000-0000-0000-000000000002');

insert into public.meetings (
  id, created_by, title, status, starts_at, ends_at
)
values (
  'b2b00000-0000-4000-8000-000000000032',
  '10000000-0000-0000-0000-000000000004', 'Absolutne spotkanie',
  'completed', '2023-01-01 18:00+00', '2023-01-01 22:00+00'
);

insert into public.meeting_game_proposals (meeting_id, game_id, proposed_by)
values ('b2b00000-0000-4000-8000-000000000032',
        'b2b00000-0000-4000-8000-000000000031',
        '10000000-0000-0000-0000-000000000002');

insert into public.meeting_game_responses (
  meeting_id, game_id, user_id, wants_to_play
)
values
  ('b2b00000-0000-4000-8000-000000000032', 'b2b00000-0000-4000-8000-000000000031', '10000000-0000-0000-0000-000000000002', true),
  ('b2b00000-0000-4000-8000-000000000032', 'b2b00000-0000-4000-8000-000000000031', '10000000-0000-0000-0000-000000000003', true),
  ('b2b00000-0000-4000-8000-000000000032', 'b2b00000-0000-4000-8000-000000000031', '10000000-0000-0000-0000-000000000004', true);

insert into public.plays (
  id, game_id, meeting_id, created_by, played_at, status, mode
)
values (
  'b2b00000-0000-4000-8000-000000000033',
  'b2b00000-0000-4000-8000-000000000031',
  'b2b00000-0000-4000-8000-000000000032',
  '10000000-0000-0000-0000-000000000005', '2023-01-01 19:00+00',
  'completed', 'competitive'
);

insert into public.play_participants (play_id, user_id, placement, is_winner)
values
  ('b2b00000-0000-4000-8000-000000000033', '10000000-0000-0000-0000-000000000002', 1, true),
  ('b2b00000-0000-4000-8000-000000000033', '10000000-0000-0000-0000-000000000003', 2, false);

select ok(private.qualifies_for_achievement(
  '10000000-0000-0000-0000-000000000002', 'the_absolute'
), '19. Absolutny: zwycięzca jednogłośnie wybranej gry kwalifikuje');

select ok(not private.qualifies_for_achievement(
  '10000000-0000-0000-0000-000000000005', 'the_absolute'
), '20. Absolutny: autor logu bez udziału i zwycięstwa nie kwalifikuje');

-- Krytyczny sukces: rating musi być wcześniejszy, próg 4 i wygrana. ----------
insert into public.games (id, title, owner_id)
values ('b2b00000-0000-4000-8000-000000000041', 'Krytyczny sukces',
        '10000000-0000-0000-0000-000000000002');
insert into public.ratings (
  game_id, user_id, overall, replayability, theme, wants_to_play_again,
  created_at, updated_at
)
values ('b2b00000-0000-4000-8000-000000000041',
        '10000000-0000-0000-0000-000000000002', 4, 4, 4, true,
        '2023-01-01', '2023-01-01');
insert into public.plays (id, game_id, created_by, played_at, status, mode)
values ('b2b00000-0000-4000-8000-000000000042',
        'b2b00000-0000-4000-8000-000000000041',
        '10000000-0000-0000-0000-000000000004', '2023-02-01',
        'completed', 'competitive');
insert into public.play_participants (play_id, user_id, placement, is_winner)
values ('b2b00000-0000-4000-8000-000000000042',
        '10000000-0000-0000-0000-000000000002', 1, true);

select ok(private.qualifies_for_achievement(
  '10000000-0000-0000-0000-000000000002',
  'critical_success_question_mark'
), '21. Krytyczny sukces: rating 4 przed późniejszą wygraną kwalifikuje');

select ok(not private.qualifies_for_achievement(
  '10000000-0000-0000-0000-000000000004',
  'critical_success_question_mark'
), '22. Krytyczny sukces: autor logu bez ratingu i udziału nie kwalifikuje');

-- Redemption Arc: trzy realne LAST, potem FIRST; tylko competitive. ----------
insert into public.games (id, title, owner_id)
select md5('stage2b-redemption-game-' || n)::uuid, 'Redemption ' || n,
       '10000000-0000-0000-0000-000000000004'
from generate_series(1, 4) as n;
insert into public.plays (id, game_id, created_by, played_at, created_at, status, mode)
select md5('stage2b-redemption-play-' || n)::uuid,
       md5('stage2b-redemption-game-' || n)::uuid,
       '10000000-0000-0000-0000-000000000003',
       '2024-01-01'::timestamptz + make_interval(days => n),
       '2024-01-01'::timestamptz + make_interval(days => n),
       'completed', 'competitive'
from generate_series(1, 4) as n;
insert into public.play_participants (play_id, user_id, placement, is_winner)
select md5('stage2b-redemption-play-' || n)::uuid,
       '10000000-0000-0000-0000-000000000004'::uuid,
       case when n = 4 then 1 else 2 end, n = 4
from generate_series(1, 4) as n
union all
select md5('stage2b-redemption-play-' || n)::uuid,
       '10000000-0000-0000-0000-000000000005'::uuid,
       case when n = 4 then 2 else 1 end, n <> 4
from generate_series(1, 4) as n;

select ok(private.qualifies_for_achievement(
  '10000000-0000-0000-0000-000000000004', 'redemption_arc'
), '23. Redemption Arc: LAST x3 plus FIRST kwalifikuje');

select ok(not private.qualifies_for_achievement(
  '10000000-0000-0000-0000-000000000005', 'redemption_arc'
), '24. Redemption Arc: FIRST x3 plus LAST nie kwalifikuje');

-- Hot Streak: admin ma 10 kolejnych zwycięstw z Candlekeep. -----------------
select ok(private.qualifies_for_achievement(
  '10000000-0000-0000-0000-000000000001', 'hot_streak'
), '25. Hot Streak: pięć kolejnych zwycięstw kwalifikuje');

select ok(not private.qualifies_for_achievement(
  '10000000-0000-0000-0000-000000000003', 'hot_streak'
), '26. Hot Streak: seria przerwana porażką nie kwalifikuje');

-- Eligibility, preview, APPLY, idempotencja i wpływ na klasy. ---------------
select ok(private.is_gamification_eligible(
  '10000000-0000-0000-0000-000000000001'
), '27. aktywny admin-gracz pozostaje eligible');

select ok(not private.is_gamification_eligible(
  '10000000-0000-0000-0000-000000000006'
), '28. nieaktywny użytkownik nie jest eligible');

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select * from public.preview_legendarium_stage2b_reconciliation()$$,
  '29. admin może uruchomić read-only preview Stage 2B'
);

reset role;

select ok(
  not exists (
    select 1 from public.user_achievements
    where user_id = '10000000-0000-0000-0000-000000000001'
      and achievement_key in ('candlekeep_sage', 'hot_streak')
  ),
  '30. preview nie zapisuje historycznych unlocków'
);

select ok(
  (select achievement_changes
   from private.apply_legendarium_stage2b_reconciliation()) > 0,
  '31. pierwszy operatorski APPLY wykonuje historyczny backfill'
);

select ok(
  exists (select 1 from public.user_achievements
          where user_id = '10000000-0000-0000-0000-000000000001'
            and achievement_key = 'candlekeep_sage'),
  '32. backfill obejmuje aktywnego admina-gracza'
);

select ok(
  not exists (select 1 from public.user_achievements
              where user_id = '10000000-0000-0000-0000-000000000006'
                and achievement_key in ('candlekeep_sage', 'hot_streak')),
  '33. backfill nie przyznaje odznak nieaktywnemu użytkownikowi'
);

select results_eq(
  $$select * from private.apply_legendarium_stage2b_reconciliation()$$,
  $$values (0, 0, 0::bigint)$$,
  '34. drugi APPLY jest idempotentny'
);

select is(
  (select count(*) from public.preview_legendarium_stage2b_reconciliation()),
  0::bigint,
  '35. po APPLY plan nie zawiera unlocków, revoke ani korekt Renomy'
);

select is(
  (select count(*) from public.point_events
   where user_id = '10000000-0000-0000-0000-000000000002'
     and action_type = 'achievement_unlocked:hot_take'),
  1::bigint,
  '36. sticky Hot Take ma dokładnie jeden append-only event'
);

select ok(
  (select count(*)
   from public.class_requirements as requirement
   join public.achievement_definitions as definition
     on definition.achievement_key = requirement.achievement_key
   where definition.automation_status in ('automatic', 'secret')) > 0,
  '37. wymagania 14 klas korzystają z urealnionych statusów automatyzacji'
);

select is(
  private.recompute_legendarium_stage2b_achievements(
    null, null, 'test_stage2b_repeat'
  ),
  0,
  '38. kolejny recompute historyczny pozostaje idempotentny'
);

insert into public.user_achievements (
  user_id, achievement_key, awarded_by, source_event_type, note
) values (
  '10000000-0000-0000-0000-000000000006',
  'glass_cannon',
  '10000000-0000-0000-0000-000000000001',
  'stage2b_sticky_test',
  'Historyczny unlock nie moze byc cofany po utracie eligibility.'
);

select ok(
  not exists (
    select 1
    from private.legendarium_stage2b_reconciliation_plan() as plan
    where plan.user_id = '10000000-0000-0000-0000-000000000006'
      and plan.achievement_key = 'glass_cannon'
      and (
        plan.current_unlocked is distinct from plan.target_unlocked
        or plan.delta <> 0
      )
  ),
  '39. preview nie cofa sticky achievementu po utracie eligibility'
);

select * from finish();
rollback;
