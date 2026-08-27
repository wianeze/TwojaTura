begin;

create extension if not exists pgtap with schema extensions;
select plan(96);

-- Fixture roles going into this file (see supabase/seed.sql):
--   10000000-...-000001 Przemek  admin,  active
--   10000000-...-000002 Marta    member, active
--   10000000-...-000003 Michał   member, active
--   10000000-...-000004 Ania     member, active
--   10000000-...-000005 Kuba     member, active
--   10000000-...-000006 (nobody) member, INACTIVE
--
-- This file promotes Kuba to 'observer' and Michał to 'admin' for the
-- duration of the transaction (rolled back at the end, like the rest of
-- this test suite) so both hidden roles have a live fixture to exercise.

update public.app_members set role = 'observer' where user_id = '10000000-0000-0000-0000-000000000005';
update public.app_members set role = 'admin' where user_id = '10000000-0000-0000-0000-000000000003';

-- ---------------------------------------------------------------------
-- 1-4. membership_role enum carries 'observer'
-- ---------------------------------------------------------------------

select lives_ok(
  $$select 'observer'::public.membership_role$$,
  '1. observer is a valid membership_role value'
);

select results_eq(
  $$select role from public.app_members where user_id = '10000000-0000-0000-0000-000000000005'$$,
  $$values ('observer'::public.membership_role)$$,
  '2. Kuba is provisioned as observer for this file'
);

select results_eq(
  $$select role from public.app_members where user_id = '10000000-0000-0000-0000-000000000003'$$,
  $$values ('admin'::public.membership_role)$$,
  '3. Michał is provisioned as a second admin for this file'
);

select results_eq(
  $$select count(*)::bigint from public.app_members where role = 'admin'::public.membership_role and is_active = true$$,
  $$values (2::bigint)$$,
  '4. two active admins exist for the last-admin-guard scenarios below'
);

-- ---------------------------------------------------------------------
-- 5-10. role helper functions
-- ---------------------------------------------------------------------

select results_eq(
  $$select private.is_observer('10000000-0000-0000-0000-000000000005')$$,
  $$values (true)$$,
  '5. is_observer is true for an observer account'
);

select results_eq(
  $$select private.is_observer('10000000-0000-0000-0000-000000000002')$$,
  $$values (false)$$,
  '6. is_observer is false for an ordinary member'
);

select is(
  (
    select pronargs::integer from pg_proc
    where proname = 'current_user_can_write'
      and pronamespace = 'private'::regnamespace
  ),
  0,
  '7. current_user_can_write takes no arguments (it always reads auth.uid())'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$select private.current_user_can_write()$$,
  $$values (true)$$,
  '8. an ordinary member can write'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$select private.current_user_can_write()$$,
  $$values (false)$$,
  '9. an observer cannot write'
);
select results_eq(
  $$select public.current_user_is_admin()$$,
  $$values (false)$$,
  '10. an observer is not reported as admin'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$select public.current_user_is_admin()$$,
  $$values (true)$$,
  '11. an admin is reported as admin via the public wrapper'
);
reset role;

-- ---------------------------------------------------------------------
-- 12-20. hidden accounts never surface via profiles/app_members SELECT
-- ---------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.profiles where id = '10000000-0000-0000-0000-000000000001'$$,
  $$values (0::bigint)$$,
  '12. an ordinary member cannot see an admin profile row'
);
select results_eq(
  $$select count(*)::bigint from public.profiles where id = '10000000-0000-0000-0000-000000000005'$$,
  $$values (0::bigint)$$,
  '13. an ordinary member cannot see an observer profile row'
);
select results_eq(
  $$select count(*)::bigint from public.app_members where user_id = '10000000-0000-0000-0000-000000000001'$$,
  $$values (0::bigint)$$,
  '14. an ordinary member cannot see an admin membership row'
);
select results_eq(
  $$select count(*)::bigint from public.app_members where user_id = '10000000-0000-0000-0000-000000000005'$$,
  $$values (0::bigint)$$,
  '15. an ordinary member cannot see an observer membership row'
);
select results_eq(
  $$select count(*)::bigint from public.profiles where id = '10000000-0000-0000-0000-000000000002'$$,
  $$values (1::bigint)$$,
  '16. an ordinary member still sees their own profile row'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.profiles where id = '10000000-0000-0000-0000-000000000005'$$,
  $$values (1::bigint)$$,
  '17. an observer can still read their own profile row'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.profiles where id = '10000000-0000-0000-0000-000000000005'$$,
  $$values (1::bigint)$$,
  '18. an admin can see an observer profile row'
);
select cmp_ok(
  (select count(*) from public.app_members),
  '>=',
  6::bigint,
  '19. an admin sees every membership row, hidden or not'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.app_members where user_id = '10000000-0000-0000-0000-000000000005'$$,
  $$values (1::bigint)$$,
  '20. an observer can still see their own membership row'
);
reset role;

-- ---------------------------------------------------------------------
-- 21-30. observer is blocked from every write path
-- ---------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$
    insert into public.games (title, owner_id, current_holder_id, min_players, max_players, status)
    values ('Obserwator', '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 2, 4, 'available')
  $$,
  '42501',
  null,
  '21. observer cannot insert a game'
);

select throws_ok(
  $$
    insert into public.ratings (game_id, user_id, overall, replayability, theme, wants_to_play_again)
    values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 8, 8, 8, true)
  $$,
  '42501',
  null,
  '22. observer cannot insert a rating'
);

select throws_ok(
  $$
    insert into public.meetings (title, created_by, starts_at, ends_at)
    values ('Spotkanie obserwatora', '10000000-0000-0000-0000-000000000005', '2026-08-01 16:00:00+00', '2026-08-01 20:00:00+00')
  $$,
  '42501',
  null,
  '23. observer cannot create a meeting'
);

select throws_ok(
  $$
    insert into public.meeting_availability (meeting_id, user_id, is_available)
    values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', true)
  $$,
  '42501',
  null,
  '24. observer cannot RSVP to a meeting'
);

select throws_ok(
  $$
    select * from public.set_meeting_game_response(
      '40000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      true
    )
  $$,
  '42501',
  null,
  '25. observer cannot answer a game poll'
);

select throws_ok(
  $$
    select * from public.propose_meeting_game(
      '40000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000003'
    )
  $$,
  '42501',
  null,
  '25b. observer cannot propose a game'
);

select throws_ok(
  $$
    insert into public.plays (game_id, created_by, played_at)
    values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', now())
  $$,
  '42501',
  null,
  '26. observer cannot log a play'
);

select throws_ok(
  $$
    insert into public.play_participants (play_id, user_id, is_winner)
    values ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', false)
  $$,
  '42501',
  null,
  '27. observer cannot join a play as a participant'
);

select throws_ok(
  $$
    insert into public.play_photos (play_id, storage_path, position, byte_size, width, height, created_by)
    values (
      '50000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000001/observer.webp',
      1, 1000, 800, 600,
      '10000000-0000-0000-0000-000000000005'
    )
  $$,
  '42501',
  null,
  '28. observer cannot attach a play photo'
);

select throws_ok(
  $$select public.set_active_class('wojownik_stolu')$$,
  '42501',
  null,
  '29. observer cannot activate a class'
);

select throws_ok(
  $$select public.reorder_play_photos('50000000-0000-0000-0000-000000000001', array[]::uuid[])$$,
  '42501',
  null,
  '30. observer cannot reorder play photos'
);
reset role;

-- ---------------------------------------------------------------------
-- 31-36. admin bypass extends to ratings / meeting_availability /
-- meeting_game_responses, which are now written only through RPC
-- ---------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$
    with changed as (
      update public.ratings set comment = 'Moderacja admina'
      where id = '31000000-0000-0000-0000-000000000001'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (1::bigint)$$,
  '31. admin edits another member''s rating'
);

select results_eq(
  $$
    with changed as (
      update public.meeting_availability set is_available = false
      where meeting_id = '40000000-0000-0000-0000-000000000001'
        and user_id = '10000000-0000-0000-0000-000000000002'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (1::bigint)$$,
  '32. admin edits another member''s RSVP'
);

select throws_ok(
  $$
    delete from public.meeting_game_responses
    where meeting_id = '40000000-0000-0000-0000-000000000001'
      and game_id = '30000000-0000-0000-0000-000000000001'
      and user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  '42501',
  null,
  '33. not even an admin deletes a response directly - writes go through RPC'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$
    with changed as (
      update public.ratings set comment = 'Nieautoryzowana edycja'
      where id = '31000000-0000-0000-0000-000000000003'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (0::bigint)$$,
  '34. an ordinary member still cannot edit someone else''s rating directly (regression guard)'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$
    delete from public.meeting_game_responses
    where meeting_id = '40000000-0000-0000-0000-000000000001'
      and game_id = '30000000-0000-0000-0000-000000000002'
      and user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  '42501',
  null,
  '35. an ordinary member still cannot delete someone else''s response directly (regression guard)'
);
select results_eq(
  $$
    with changed as (
      update public.meeting_availability set is_available = true
      where meeting_id = '40000000-0000-0000-0000-000000000001'
        and user_id = '10000000-0000-0000-0000-000000000002'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (0::bigint)$$,
  '36. an ordinary member still cannot edit someone else''s RSVP directly (regression guard)'
);
reset role;

-- ---------------------------------------------------------------------
-- 37-40. get_leaderboard() używa WIDOCZNOŚCI PUBLICZNEJ, nie kwalifikacji
-- do grywalizacji: admin zdobywa Renomę, ale nie jest pokazywany innym.
-- ---------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.get_leaderboard() where user_id = '10000000-0000-0000-0000-000000000001'$$,
  $$values (0::bigint)$$,
  '37. the leaderboard hides an admin, even one who earns Renown'
);
select results_eq(
  $$select count(*)::bigint from public.get_leaderboard() where user_id = '10000000-0000-0000-0000-000000000005'$$,
  $$values (0::bigint)$$,
  '38. the leaderboard never lists an observer, even one with banked points'
);
select results_eq(
  $$select count(*)::bigint from public.get_leaderboard() where user_id = '10000000-0000-0000-0000-000000000002'$$,
  $$values (1::bigint)$$,
  '39. the leaderboard still lists an ordinary member'
);
select cmp_ok(
  (select count(*) from public.get_leaderboard()),
  '=',
  2::bigint,
  '40. only publicly visible accounts rank (Marta, Ania)'
);
reset role;

-- ---------------------------------------------------------------------
-- 40a-40f. public.get_public_player_profiles — publiczny wygląd gracza
-- ---------------------------------------------------------------------
--
-- Stan kont w tym miejscu: ...0001 admin aktywny, ...0002 member aktywny
-- (widz), ...0003 admin aktywny, ...0004 member aktywny, ...0005 obserwator
-- aktywny, ...0006 member nieaktywny.

update public.profiles
set active_class_key = 'bard_stolu'
where id = '10000000-0000-0000-0000-000000000004';
update public.profiles
set active_class_key = 'druid_polki'
where id = '10000000-0000-0000-0000-000000000001';
update public.profiles
set active_class_key = 'kleryk_druzyny'
where id = '10000000-0000-0000-0000-000000000005';

-- Kontrakt kolumn: jawna lista bez adresu e-mail i bez pól administracyjnych.
select is(
  pg_get_function_result('public.get_public_player_profiles()'::regprocedure),
  'TABLE(user_id uuid, display_name text, avatar_url text, active_class_key text, active_portrait_frame_key text, equipped_title_id uuid, equipped_title_name text, equipped_title_rarity text)',
  '40a. publiczna projekcja zawiera wyłącznie bezpieczne pola rankingu i kosmetycznego Tytułu'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$
    select active_class_key from public.get_public_player_profiles()
    where user_id = '10000000-0000-0000-0000-000000000004'
  $$,
  $$values ('bard_stolu')$$,
  '40b. a member sees another member class badge'
);

select results_eq(
  $$
    select count(*)::bigint from public.get_public_player_profiles()
    where user_id = '10000000-0000-0000-0000-000000000001'
  $$,
  $$values (0::bigint)$$,
  '40c. a member does NOT see an admin in the public player projection'
);

-- Ukrywamy admina przed innymi, nie przed nim samym.
reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$
    select active_class_key from public.get_public_player_profiles()
    where user_id = '10000000-0000-0000-0000-000000000001'
  $$,
  $$values ('druid_polki')$$,
  '40c1. an admin still sees their own public player data'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$
    select count(*)::bigint from public.get_public_player_profiles()
    where user_id = '10000000-0000-0000-0000-000000000005'
  $$,
  $$values (0::bigint)$$,
  '40d. an observer exposes no public player data'
);

select results_eq(
  $$
    select count(*)::bigint from public.get_public_player_profiles()
    where user_id = '10000000-0000-0000-0000-000000000006'
  $$,
  $$values (0::bigint)$$,
  '40e. an inactive account exposes no public player data'
);

-- Regresja przeciw poluzowaniu RLS: sama tabela profiles ma zostać zamknięta.
select results_eq(
  $$
    select count(*)::bigint from public.profiles
    where id = '10000000-0000-0000-0000-000000000001'
  $$,
  $$values (0::bigint)$$,
  '40f. the admin profile row itself stays hidden — no wider RLS access'
);
reset role;

-- ---------------------------------------------------------------------
-- 41-48. Uprawnienia administracyjne NIE wykluczają z grywalizacji;
-- obserwator nadal jest wykluczony. Jedno źródło reguły:
-- private.is_gamification_eligible.
-- ---------------------------------------------------------------------

select results_eq(
  $$
    select awarded, points
    from private.award_points_once(
      '10000000-0000-0000-0000-000000000001',
      'shelf_first_game',
      'profile',
      '10000000-0000-0000-0000-000000000001',
      null,
      null
    )
  $$,
  $$values (true, 10)$$,
  '41. an admin who plays still earns Renown'
);

select results_eq(
  $$
    select count(*)::bigint from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000001'
      and action_type = 'shelf_first_game'
  $$,
  $$values (1::bigint)$$,
  '42. the admin point event is written exactly once'
);

select results_eq(
  $$
    select awarded, points, point_event_id
    from private.award_points_once(
      '10000000-0000-0000-0000-000000000005',
      'shelf_first_game',
      'profile',
      '10000000-0000-0000-0000-000000000005',
      null,
      null
    )
  $$,
  $$values (false, 0, null::uuid)$$,
  '43. award_points_once stays a no-op for an observer recipient'
);

select results_eq(
  $$
    select count(*)::bigint from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000005'
      and action_type = 'shelf_first_game'
  $$,
  $$values (0::bigint)$$,
  '44. no point event is created for the observer no-op'
);

select results_eq(
  $$
    select awarded, achievement_key, points_awarded
    from private.award_achievement_once(
      '10000000-0000-0000-0000-000000000001',
      'dice_speak',
      'test',
      null,
      null,
      null
    )
  $$,
  $$values (true, 'dice_speak', 20)$$,
  '45. an admin who plays still earns achievements'
);

select results_eq(
  $$
    select count(*)::bigint from public.user_achievements
    where user_id = '10000000-0000-0000-0000-000000000001'
      and achievement_key = 'dice_speak'
  $$,
  $$values (1::bigint)$$,
  '46. the admin achievement row is written exactly once'
);

select results_eq(
  $$
    select awarded, achievement_key, awarded_at, points_awarded, point_event_id
    from private.award_achievement_once(
      '10000000-0000-0000-0000-000000000005',
      'dice_speak',
      'test',
      null,
      null,
      null
    )
  $$,
  $$values (false, 'dice_speak', null::timestamptz, 0, null::uuid)$$,
  '47. award_achievement_once stays a no-op for an observer recipient'
);

select results_eq(
  $$
    select count(*)::bigint from public.user_achievements
    where user_id = '10000000-0000-0000-0000-000000000005'
      and achievement_key = 'dice_speak'
  $$,
  $$values (0::bigint)$$,
  '48. no achievement row is created for the observer no-op'
);

-- ---------------------------------------------------------------------
-- 48a-48d. odznaki innych graczy — druga publiczna ścieżka Legendarium
-- ---------------------------------------------------------------------
--
-- Sam ranking admina już nie pokaże, ale odznaki przy wierszach rankingu
-- warstwa TS czyta wprost z public.user_achievements. Bez filtru po roli dane
-- admina wracałyby tą drogą.
--
-- Fixture: ta sama, NIESEKRETNA odznaka u membera i u admina. Gdyby ukrywanie
-- wynikało z sekretności odznaki, a nie z roli konta, oba testy dałyby ten sam
-- wynik.

insert into public.user_achievements (user_id, achievement_key)
values
  ('10000000-0000-0000-0000-000000000004', 'critical_roll'),
  ('10000000-0000-0000-0000-000000000001', 'critical_roll'),
  ('10000000-0000-0000-0000-000000000005', 'critical_roll')
on conflict on constraint user_achievements_pkey do nothing;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$
    select count(*)::bigint from public.user_achievements
    where user_id = '10000000-0000-0000-0000-000000000004'
      and achievement_key = 'critical_roll'
  $$,
  $$values (1::bigint)$$,
  '48a. a member sees another member public badge'
);

select results_eq(
  $$
    select count(*)::bigint from public.user_achievements
    where user_id = '10000000-0000-0000-0000-000000000001'
      and achievement_key = 'critical_roll'
  $$,
  $$values (0::bigint)$$,
  '48b. a member does NOT see an admin badge, even a public one'
);
reset role;

-- Ukrywamy przed innymi, nie przed właścicielem.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$
    select count(*)::bigint from public.user_achievements
    where user_id = '10000000-0000-0000-0000-000000000001'
      and achievement_key = 'critical_roll'
  $$,
  $$values (1::bigint)$$,
  '48c. an admin still sees their own badges'
);
reset role;

-- Regresja przeciw zbyt szerokiemu zawężeniu: obserwator, choć publicznie
-- niewidoczny, nie może stracić wglądu we własne wiersze.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$
    select count(*)::bigint from public.user_achievements
    where user_id = '10000000-0000-0000-0000-000000000005'
      and achievement_key = 'critical_roll'
  $$,
  $$values (1::bigint)$$,
  '48d. an observer still sees their own badges'
);
reset role;

-- ---------------------------------------------------------------------
-- 49-52. the admin manual point-adjustment bypass can never target a
-- hidden account, including the admin's own
-- ---------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$
    insert into public.point_events (user_id, points, action_type, created_by)
    values ('10000000-0000-0000-0000-000000000001', 5, 'admin_adjustment', '10000000-0000-0000-0000-000000000001')
  $$,
  '42501',
  null,
  '49. admin cannot manually award points to themselves'
);

select throws_ok(
  $$
    insert into public.point_events (user_id, points, action_type, created_by)
    values ('10000000-0000-0000-0000-000000000005', 5, 'admin_adjustment', '10000000-0000-0000-0000-000000000001')
  $$,
  '42501',
  null,
  '50. admin cannot manually award points to an observer'
);

select lives_ok(
  $$
    insert into public.point_events (user_id, points, action_type, created_by)
    values ('10000000-0000-0000-0000-000000000002', 5, 'admin_adjustment', '10000000-0000-0000-0000-000000000001')
  $$,
  '51. admin can still manually award points to an ordinary member'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$
    insert into public.point_events (user_id, points, action_type, created_by)
    values ('10000000-0000-0000-0000-000000000002', 5, 'admin_adjustment', '10000000-0000-0000-0000-000000000005')
  $$,
  '42501',
  null,
  '52. an observer cannot use the admin manual point-adjustment bypass either'
);
reset role;

-- ---------------------------------------------------------------------
-- 53-58. admin_audit_log is admin-only to read and cannot be written
-- directly by any client role
-- ---------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.admin_audit_log$$,
  $$values (0::bigint)$$,
  '53. an ordinary member cannot read the admin audit log'
);
select throws_ok(
  $$insert into public.admin_audit_log (actor_user_id, action_type) values ('10000000-0000-0000-0000-000000000002', 'role_change')$$,
  '42501',
  null,
  '54. an ordinary member cannot insert into the admin audit log directly'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.admin_audit_log (actor_user_id, action_type) values ('10000000-0000-0000-0000-000000000001', 'role_change')$$,
  '42501',
  null,
  '55. even an admin cannot insert into the audit log directly — only the RPCs may'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.admin_audit_log$$,
  $$values (0::bigint)$$,
  '56. an observer cannot read the admin audit log either'
);
reset role;

select results_eq(
  $$
    select relrowsecurity from pg_class
    where oid = 'public.admin_audit_log'::regclass
  $$,
  $$values (true)$$,
  '57. RLS is enabled on the admin audit log table'
);

select results_eq(
  $$
    select count(*)::bigint from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_audit_log'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  $$,
  $$values (0::bigint)$$,
  '58. no INSERT/UPDATE/DELETE policy exists for the admin audit log — writes are RPC-only'
);

-- ---------------------------------------------------------------------
-- 59-76. /admin panel RPCs: access control, role changes, deactivation
-- ---------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select * from public.admin_list_accounts(null, null)$$,
  '42501',
  null,
  '59. a non-admin cannot list accounts'
);
select throws_ok(
  $$select public.admin_change_role('10000000-0000-0000-0000-000000000004', 'observer'::public.membership_role, null)$$,
  '42501',
  null,
  '60. a non-admin cannot change roles'
);
select throws_ok(
  $$select public.admin_deactivate_and_anonymize_account('10000000-0000-0000-0000-000000000004', null)$$,
  '42501',
  null,
  '61. a non-admin cannot deactivate an account'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select cmp_ok(
  (select count(*) from public.admin_list_accounts(null, null)),
  '>=',
  6::bigint,
  '62. an admin lists every account, hidden or not'
);

select results_eq(
  $$select user_id from public.admin_list_accounts(null, 'observer'::public.membership_role)$$,
  $$values ('10000000-0000-0000-0000-000000000005'::uuid)$$,
  '63. the role filter narrows the account list to observers only'
);

select results_eq(
  $$select user_id from public.admin_list_accounts('Marta', null)$$,
  $$values ('10000000-0000-0000-0000-000000000002'::uuid)$$,
  '64. the search filter matches by display name'
);

select throws_ok(
  $$select public.admin_change_role('10000000-0000-0000-0000-000000000001', 'member'::public.membership_role, null)$$,
  '42501',
  null,
  '65. an admin cannot strip their own admin role'
);

select lives_ok(
  $$select public.admin_change_role('10000000-0000-0000-0000-000000000004', 'observer'::public.membership_role, 'promocja testowa')$$,
  '66. an admin promotes an ordinary member to observer'
);

select results_eq(
  $$select role from public.app_members where user_id = '10000000-0000-0000-0000-000000000004'$$,
  $$values ('observer'::public.membership_role)$$,
  '67. the role change is persisted'
);

select results_eq(
  $$
    select action_type, old_value, new_value, reason
    from public.admin_audit_log
    where target_user_id = '10000000-0000-0000-0000-000000000004'
      and action_type = 'role_change'
  $$,
  $$
    values (
      'role_change',
      jsonb_build_object('role', 'member'),
      jsonb_build_object('role', 'observer'),
      'promocja testowa'
    )
  $$,
  '68. the role change is recorded in the audit log'
);

select throws_ok(
  $$select public.admin_change_role('00000000-0000-0000-0000-000000000099', 'member'::public.membership_role, null)$$,
  'P0002',
  null,
  '69. changing the role of an unknown account raises a not-found error'
);

select throws_ok(
  $$select public.admin_deactivate_and_anonymize_account('10000000-0000-0000-0000-000000000001', null)$$,
  '42501',
  null,
  '70. an admin cannot deactivate their own account'
);

select lives_ok(
  $$select public.admin_deactivate_and_anonymize_account('10000000-0000-0000-0000-000000000004', 'rezygnacja testowa')$$,
  '71. an admin deactivates and anonymizes another account'
);

select results_eq(
  $$
    select is_active, display_name, email, avatar_url
    from public.app_members
    join public.profiles on profiles.id = app_members.user_id
    where user_id = '10000000-0000-0000-0000-000000000004'
  $$,
  $$values (false, 'Usunięty użytkownik', 'usuniety-10000000@deleted.local', null::text)$$,
  '72. the account is deactivated and its profile anonymized'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.admin_audit_log
    where target_user_id = '10000000-0000-0000-0000-000000000004'
      and action_type = 'account_deactivated_anonymized'
  $$,
  $$values (1::bigint)$$,
  '73. the deactivation is recorded in the audit log exactly once'
);

select lives_ok(
  $$select public.admin_deactivate_and_anonymize_account('10000000-0000-0000-0000-000000000004', null)$$,
  '74. deactivating an already-inactive account is a harmless idempotent no-op'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.admin_audit_log
    where target_user_id = '10000000-0000-0000-0000-000000000004'
      and action_type = 'account_deactivated_anonymized'
  $$,
  $$values (1::bigint)$$,
  '75. the idempotent retry does not create a second audit log entry'
);

select throws_ok(
  $$select public.admin_deactivate_and_anonymize_account('00000000-0000-0000-0000-000000000099', null)$$,
  'P0002',
  null,
  '76. deactivating an unknown account raises a not-found error'
);

-- With two active admins (Przemek, Michał) demoting the *other* admin is
-- allowed — the last-admin guard only ever blocks a change that would
-- leave zero active admins, never a change that leaves one.
select lives_ok(
  $$select public.admin_change_role('10000000-0000-0000-0000-000000000003', 'member'::public.membership_role, 'powrót do jednego admina')$$,
  '77. an admin demotes the other admin while at least one active admin remains'
);

select results_eq(
  $$select role from public.app_members where user_id = '10000000-0000-0000-0000-000000000003'$$,
  $$values ('member'::public.membership_role)$$,
  '78. the second admin''s demotion is persisted'
);
reset role;


-- ---------------------------------------------------------------------
-- 80-83. leaderboard widoczność == private.is_public_gamification_visible
-- ---------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

-- Stan kont w tym miejscu pliku (zbudowany przez wcześniejsze testy):
--   ...0001 Przemek  admin,     aktywny   -> ZDOBYWA, ale nie rankuje
--   ...0002 Marta    member,    aktywny   -> rankuje
--   ...0003 Michał   member,    aktywny   -> rankuje (test 78 cofnął go z admina)
--   ...0004 Ania     observer,  nieaktywna (testy 62 i 68) -> nie rankuje
--   ...0005 Kuba     observer,  aktywny   -> nie rankuje
--   ...0006 Nieaktywny member,  nieaktywny -> nie rankuje
select results_eq(
  $$
    select user_id, rank
    from public.get_leaderboard()
  $$,
  $$
    values
      ('10000000-0000-0000-0000-000000000002'::uuid, 1::bigint),
      ('10000000-0000-0000-0000-000000000003'::uuid, 2::bigint)
  $$,
  '80. only publicly visible players rank — the admin is hidden'
);

select results_eq(
  $$
    select count(*)::bigint from public.get_leaderboard()
    where user_id in (
      '10000000-0000-0000-0000-000000000004',
      '10000000-0000-0000-0000-000000000006'
    )
  $$,
  $$values (0::bigint)$$,
  '81. an inactive account never ranks'
);
reset role;

-- Ukrycie w rankingu nie może niczego skasować ani pominąć w księdze:
-- admin ma nadal dodatnie saldo i pełną historię zdarzeń.
select cmp_ok(
  (
    select coalesce(sum(event.points), 0)::bigint
    from public.point_events as event
    where event.user_id = '10000000-0000-0000-0000-000000000001'
  ),
  '>',
  0::bigint,
  '80a. hiding the admin from the ranking leaves their Renown untouched'
);

-- Progres i widoczność to dwie różne odpowiedzi dla tego samego konta.
select results_eq(
  $$
    select
      private.is_gamification_eligible('10000000-0000-0000-0000-000000000001'),
      private.is_public_gamification_visible('10000000-0000-0000-0000-000000000001')
  $$,
  $$values (true, false)$$,
  '80b. an admin is gamification eligible but not publicly visible'
);

select results_eq(
  $$
    select
      private.is_gamification_eligible('10000000-0000-0000-0000-000000000002'),
      private.is_public_gamification_visible('10000000-0000-0000-0000-000000000002')
  $$,
  $$values (true, true)$$,
  '80c. an ordinary member is both eligible and publicly visible'
);

-- Reguła nie może być powielona: zbiór rankujących ma być DOKŁADNIE zbiorem
-- kont widocznych publicznie.
select is_empty(
  $$
    select membership.user_id
    from public.app_members as membership
    where private.is_public_gamification_visible(membership.user_id)
      <> exists (
        select 1 from public.get_leaderboard() as entry
        where entry.user_id = membership.user_id
      )
  $$,
  '82. leaderboard membership matches private.is_public_gamification_visible exactly'
);

select * from finish();
rollback;
