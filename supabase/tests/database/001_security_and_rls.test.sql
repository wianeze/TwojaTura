begin;

create extension if not exists pgtap with schema extensions;
select plan(62);

-- 1. Anonymous users have no table privileges.
set local role anon;
select throws_ok(
  $$select * from public.games$$,
  '42501',
  null,
  '1. anon cannot read application data'
);
reset role;

-- 2. An inactive authenticated member is filtered by RLS.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.games$$,
  $$values (0::bigint)$$,
  '2. inactive member cannot read application data'
);
reset role;

-- Authenticate as Marta (active member).
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select cmp_ok(
  (select count(*) from public.games),
  '>=',
  4::bigint,
  '3. active member reads the shared shelf'
);

select lives_ok(
  $$
    insert into public.games (
      id, title, owner_id, current_holder_id, min_players, max_players, status
    ) values (
      '70000000-0000-0000-0000-000000000001', 'Test Marty',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002', 2, 4, 'available'
    )
  $$,
  '4. member inserts a game they own'
);

select results_eq(
  $$
    with changed as (
      update public.games
      set description = 'Edycja właścicielki'
      where id = '70000000-0000-0000-0000-000000000001'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (1::bigint)$$,
  '5. member edits their own game'
);

select results_eq(
  $$
    with changed as (
      update public.games
      set archived_at = '2026-07-04 12:00:00+00'
      where id = '70000000-0000-0000-0000-000000000001'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (1::bigint)$$,
  '6. member archives their own game'
);

select throws_ok(
  $$
    update public.games
    set owner_id = '10000000-0000-0000-0000-000000000003'
    where id = '70000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  null,
  '7. member cannot transfer owner_id to another user'
);

select results_eq(
  $$
    with changed as (
      update public.games
      set description = 'Niedozwolona edycja'
      where id = '30000000-0000-0000-0000-000000000003'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (0::bigint)$$,
  '8. member cannot edit another user game'
);
reset role;

-- Authenticate as admin.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$
    with changed as (
      update public.games
      set owner_id = '10000000-0000-0000-0000-000000000003'
      where id = '70000000-0000-0000-0000-000000000001'
      returning owner_id
    )
    select owner_id from changed
  $$,
  $$values ('10000000-0000-0000-0000-000000000003'::uuid)$$,
  '9. admin transfers game owner_id'
);

select results_eq(
  $$
    with changed as (
      update public.games
      set current_holder_id = '10000000-0000-0000-0000-000000000005'
      where id = '70000000-0000-0000-0000-000000000001'
      returning current_holder_id
    )
    select current_holder_id from changed
  $$,
  $$values ('10000000-0000-0000-0000-000000000005'::uuid)$$,
  '10. admin changes current holder of another user game'
);
reset role;

-- Marta owns meeting 400...002.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$
    with changed as (
      update public.meetings
      set description = 'Edycja Marty'
      where id = '40000000-0000-0000-0000-000000000002'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (1::bigint)$$,
  '11. member edits only their own meeting'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$
    with changed as (
      update public.meetings
      set description = 'Korekta administratora'
      where id = '40000000-0000-0000-0000-000000000002'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (1::bigint)$$,
  '12. admin edits another user meeting'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    update public.meetings
    set selected_option_id = '41000000-0000-0000-0000-000000000001'
    where id = '40000000-0000-0000-0000-000000000002'
  $$,
  '23503',
  null,
  '13. selected option from a different meeting is rejected'
);

select results_eq(
  $$
    with changed as (
      update public.meeting_availability
      set is_available = false
      where meeting_option_id = '41000000-0000-0000-0000-000000000001'
        and user_id = '10000000-0000-0000-0000-000000000002'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (1::bigint)$$,
  '14. user updates only their own availability'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    insert into public.meeting_availability (
      meeting_option_id, user_id, is_available
    ) values (
      '41000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000005', true
    )
  $$,
  '42501',
  null,
  '15. admin cannot impersonate another availability response'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    insert into public.meeting_game_votes (meeting_id, game_id, user_id)
    values (
      '40000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000004'
    )
  $$,
  '16. user inserts their own game vote'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    insert into public.meeting_game_votes (meeting_id, game_id, user_id)
    values (
      '40000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000005'
    )
  $$,
  '42501',
  null,
  '17. admin cannot impersonate another game vote'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;
insert into public.ratings (
  id, game_id, user_id, overall, replayability, theme, wants_to_play_again
)
values (
  '71000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004', 8, 8, 9, true
);
select results_eq(
  $$
    with own_change as (
      update public.ratings
      set overall = 9
      where id = '71000000-0000-0000-0000-000000000001'
      returning 1
    ), foreign_change as (
      update public.ratings
      set overall = 1
      where id = '31000000-0000-0000-0000-000000000001'
      returning 1
    )
    select
      (select count(*)::bigint from own_change),
      (select count(*)::bigint from foreign_change)
  $$,
  $$values (1::bigint, 0::bigint)$$,
  '18. user updates their own rating but not another rating'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    insert into public.plays (
      id, game_id, meeting_id, created_by, played_at, duration_minutes
    ) values (
      '70000000-0000-0000-0000-000000000010',
      '30000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002', now(), 90
    )
  $$,
  '19. member creates their own play'
);

select lives_ok(
  $$
    insert into public.plays (
      id, game_id, meeting_id, created_by, played_at, duration_minutes
    ) values (
      '70000000-0000-0000-0000-000000000011',
      '30000000-0000-0000-0000-000000000004', null,
      '10000000-0000-0000-0000-000000000002', now(), 45
    )
  $$,
  '20. spontaneous play with null meeting_id is allowed'
);

select lives_ok(
  $$
    insert into public.play_participants (
      play_id, user_id, placement, score, is_winner
    ) values (
      '70000000-0000-0000-0000-000000000010',
      '10000000-0000-0000-0000-000000000002', 1, 50, true
    )
  $$,
  '21. member manages participants of their own play'
);

select results_eq(
  $$
    with changed as (
      update public.play_participants
      set score = 999
      where play_id = '50000000-0000-0000-0000-000000000002'
        and user_id = '10000000-0000-0000-0000-000000000005'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (0::bigint)$$,
  '22. member cannot edit participants of another play'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$
    with changed as (
      update public.play_participants
      set score = 41
      where play_id = '50000000-0000-0000-0000-000000000001'
        and user_id = '10000000-0000-0000-0000-000000000002'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (1::bigint)$$,
  '23. admin edits participants of any play'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select cmp_ok(
  (select count(*) from public.app_content),
  '>=',
  7::bigint,
  '24. member reads app_content'
);

select results_eq(
  $$
    with changed as (
      update public.app_content
      set value = 'Niedozwolona zmiana'
      where content_key = 'shelf.heading'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (0::bigint)$$,
  '25. member cannot change app_content'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$
    with changed as (
      update public.app_content
      set value = 'Półka całej grupy'
      where content_key = 'shelf.heading'
      returning updated_by
    )
    select updated_by from changed
  $$,
  $$values ('10000000-0000-0000-0000-000000000001'::uuid)$$,
  '26. admin changes app_content and becomes updated_by'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.point_events$$,
  $$values (1::bigint)$$,
  '27. member sees their own point_events ledger'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.point_events
    where user_id <> auth.uid()
  $$,
  $$values (0::bigint)$$,
  '28. member cannot see another user point_events'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select cmp_ok(
  (select count(*) from public.point_events),
  '>=',
  5::bigint,
  '29. admin sees every point_events ledger'
);

select throws_ok(
  $$
    update public.point_events
    set points = 1
    where id = '60000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  null,
  '30. point_events update is rejected'
);

select throws_ok(
  $$
    delete from public.point_events
    where id = '60000000-0000-0000-0000-000000000001'
  $$,
  '42501',
  null,
  '31. point_events delete is rejected'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select total_points from public.user_point_balances$$,
  $$values (1080::bigint)$$,
  '32. user balance equals SUM(points)'
);

select results_eq(
  $$select count(*)::bigint from public.get_leaderboard()$$,
  $$values (5::bigint)$$,
  '33. active member sees the limited global leaderboard'
);

select ok(
  not exists (
    select 1
    from public.get_leaderboard() as leaderboard,
    lateral jsonb_object_keys(to_jsonb(leaderboard)) as exposed(key)
    where exposed.key in (
      'description', 'related_entity_id', 'created_by', 'action_type', 'created_at'
    )
  ),
  '34. leaderboard does not expose point ledger details'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    insert into public.point_events (
      id, user_id, points, action_type, description, created_by
    ) values (
      '70000000-0000-0000-0000-000000000020',
      '10000000-0000-0000-0000-000000000005',
      20, 'admin_adjustment', 'Korekta testowa',
      '10000000-0000-0000-0000-000000000001'
    )
  $$,
  '35. admin adjustment creates point_event'
);

select ok(
  exists (
    select 1 from public.audit_log
    where action in ('game.owner_changed', 'game.current_holder_changed')
  ),
  '36. important administrative change creates audit_log'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.audit_log$$,
  $$values (0::bigint)$$,
  '37. member cannot read audit_log'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select cmp_ok(
  (select count(*) from public.audit_log),
  '>',
  0::bigint,
  '38. admin reads audit_log'
);

select throws_ok(
  $$
    insert into public.audit_log (
      actor_user_id, action, entity_type
    ) values (
      '10000000-0000-0000-0000-000000000001', 'fake', 'fake'
    )
  $$,
  '42501',
  null,
  '39. client cannot insert directly into audit_log'
);

select ok(
  not has_table_privilege('authenticated', 'public.audit_log', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.audit_log', 'DELETE'),
  '40. client has no update or delete privilege on audit_log'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select is_active from public.get_own_membership_status()$$,
  $$values (false)$$,
  '41. inactive user can read only their own membership gate state'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-0000-0000-000000000099","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.get_own_membership_status()$$,
  $$values (0::bigint)$$,
  '42. authenticated user without membership receives no membership row'
);
reset role;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '90000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'invite-test@twojatura.local',
  extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Zaproszony Gracz","twoja_tura_invite":true}',
  now(), now()
);

select ok(
  exists (
    select 1 from public.profiles
    where id = '90000000-0000-0000-0000-000000000001'
      and display_name = 'Zaproszony Gracz'
  ),
  '43. marked invite provisions a profile'
);

select results_eq(
  $$select role from public.app_members where user_id = '90000000-0000-0000-0000-000000000001'$$,
  $$values ('member'::public.membership_role)$$,
  '44. invite provisioning always assigns member role'
);

select results_eq(
  $$select is_active from public.app_members where user_id = '90000000-0000-0000-0000-000000000001'$$,
  $$values (true)$$,
  '45. invite provisioning activates membership'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '90000000-0000-0000-0000-000000000002',
  'authenticated', 'authenticated', 'unmarked-test@twojatura.local',
  extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Bez Zaproszenia"}',
  now(), now()
);

select ok(
  not exists (
    select 1 from public.profiles
    where id = '90000000-0000-0000-0000-000000000002'
  ),
  '46. unmarked auth user is not provisioned as an app member'
);

select results_eq(
  $$
    select count(*)::bigint
    from auth.users
    where email in (
      'admin@twojatura.local',
      'marta@twojatura.local',
      'michal@twojatura.local',
      'ania@twojatura.local',
      'kuba@twojatura.local',
      'inactive@twojatura.local'
    )
  $$,
  $$values (6::bigint)$$,
  '47. all expected seeded password users exist'
);

select ok(
  not exists (
    select 1
    from auth.users
    where email in (
      'admin@twojatura.local',
      'marta@twojatura.local',
      'michal@twojatura.local',
      'ania@twojatura.local',
      'kuba@twojatura.local',
      'inactive@twojatura.local'
    )
      and (
        confirmation_token is null
        or recovery_token is null
        or email_change is null
        or email_change_token_new is null
      )
  ),
  '48. seeded password users satisfy GoTrue string field expectations'
);

reset role;

set local role anon;
select throws_ok(
  $$select * from public.game_expansions$$,
  '42501',
  null,
  '49. anon cannot read game_expansions'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.game_expansions$$,
  $$values (0::bigint)$$,
  '50. inactive member cannot read game_expansions'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select cmp_ok(
  (select count(*) from public.game_expansions),
  '>=',
  5::bigint,
  '51. active member reads game_expansions'
);

select lives_ok(
  $$
    insert into public.game_expansions (id, game_id, name, is_owned)
    values (
      '72000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000002',
      'Testowy Dodatek Marty',
      true
    )
  $$,
  '52. owner inserts expansion for own game'
);

select results_eq(
  $$
    with changed as (
      update public.game_expansions
      set is_owned = false
      where id = '72000000-0000-0000-0000-000000000001'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (1::bigint)$$,
  '53. owner updates own expansion'
);

select results_eq(
  $$
    with deleted as (
      delete from public.game_expansions
      where id = '72000000-0000-0000-0000-000000000001'
      returning 1
    )
    select count(*)::bigint from deleted
  $$,
  $$values (1::bigint)$$,
  '54. owner deletes own expansion'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    insert into public.game_expansions (id, game_id, name, is_owned)
    values (
      '72000000-0000-0000-0000-000000000002',
      '30000000-0000-0000-0000-000000000002',
      'Niedozwolony dodatek',
      true
    )
  $$,
  '42501',
  null,
  '55. different member cannot insert expansion for someone else game'
);

select results_eq(
  $$
    with changed as (
      update public.game_expansions
      set is_owned = false
      where game_id = '30000000-0000-0000-0000-000000000002'
        and name = 'Lodowe Kry'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (0::bigint)$$,
  '56. different member cannot update expansion for someone else game'
);

select results_eq(
  $$
    with deleted as (
      delete from public.game_expansions
      where game_id = '30000000-0000-0000-0000-000000000002'
        and name = 'Lodowe Kry'
      returning 1
    )
    select count(*)::bigint from deleted
  $$,
  $$values (0::bigint)$$,
  '57. different member cannot delete expansion for someone else game'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    insert into public.game_expansions (id, game_id, name, is_owned)
    values (
      '72000000-0000-0000-0000-000000000003',
      '30000000-0000-0000-0000-000000000002',
      'Admin Test',
      false
    )
  $$,
  '58. admin can insert any expansion'
);

select results_eq(
  $$
    with changed as (
      update public.game_expansions
      set is_owned = true
      where id = '72000000-0000-0000-0000-000000000003'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (1::bigint)$$,
  '59. admin can update any expansion'
);

select results_eq(
  $$
    with deleted as (
      delete from public.game_expansions
      where id = '72000000-0000-0000-0000-000000000003'
      returning 1
    )
    select count(*)::bigint from deleted
  $$,
  $$values (1::bigint)$$,
  '60. admin can delete any expansion'
);

select throws_ok(
  $$
    insert into public.game_expansions (id, game_id, name, is_owned)
    values (
      '72000000-0000-0000-0000-000000000004',
      '30000000-0000-0000-0000-000000000002',
      '  lodowe kry  ',
      true
    )
  $$,
  '23505',
  null,
  '61. duplicate expansion name for same game is rejected'
);

select lives_ok(
  $$
    insert into public.game_expansions (id, game_id, name, is_owned)
    values (
      '72000000-0000-0000-0000-000000000005',
      '30000000-0000-0000-0000-000000000003',
      'Lodowe Kry',
      false
    )
  $$,
  '62. same expansion name for different physical game copy is allowed'
);

select * from finish();
rollback;
