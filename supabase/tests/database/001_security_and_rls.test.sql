begin;

create extension if not exists pgtap with schema extensions;
select plan(100);

create temporary table pgtap_created_plays (
  label text primary key,
  play_id uuid not null
);

grant select, insert, update, delete
on table pgtap_created_plays
to authenticated;

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
select lives_ok(
  $$
    insert into public.meetings (
      id, created_by, title, status, starts_at, ends_at
    ) values (
      '70000000-0000-0000-0000-000000000030',
      '10000000-0000-0000-0000-000000000002',
      'Nowe spotkanie Marty',
      'planned',
      '2026-07-22 16:00:00+00',
      '2026-07-22 20:00:00+00'
    )
  $$,
  '13. member creates their own meeting'
);

select results_eq(
  $$
    with changed as (
      update public.meeting_availability
      set is_available = false
      where meeting_id = '40000000-0000-0000-0000-000000000001'
        and user_id = '10000000-0000-0000-0000-000000000002'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (1::bigint)$$,
  '14. user updates only their own RSVP response'
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
      meeting_id, user_id, is_available
    ) values (
      '40000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000005', true
    )
  $$,
  '42501',
  null,
  '15. admin cannot impersonate another RSVP response'
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

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    insert into pgtap_created_plays (label, play_id)
    select
      'rpc_create_member',
      public.create_play_with_participants(
        '30000000-0000-0000-0000-000000000001',
        now(),
        '40000000-0000-0000-0000-000000000001',
        88,
        'RPC create',
        jsonb_build_array(
          jsonb_build_object(
            'user_id', '10000000-0000-0000-0000-000000000002',
            'placement', 1,
            'score', 52,
            'is_winner', true
          ),
          jsonb_build_object(
            'user_id', '10000000-0000-0000-0000-000000000003',
            'placement', 2,
            'score', 44,
            'is_winner', false
          )
        )
      )
  $$,
  '63. member can create own play through create_play_with_participants'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.play_participants
    where play_id = (
      select play_id
      from pgtap_created_plays
      where label = 'rpc_create_member'
    )
  $$,
  $$values (2::bigint)$$,
  '64. atomowy create zapisuje play_participants'
);

select lives_ok(
  $$
    select public.update_play_with_participants(
      '50000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      now(),
      '40000000-0000-0000-0000-000000000002',
      111,
      'RPC update owner',
      jsonb_build_array(
        jsonb_build_object(
          'user_id', '10000000-0000-0000-0000-000000000002',
          'placement', 1,
          'score', 60,
          'is_winner', true
        ),
        jsonb_build_object(
          'user_id', '10000000-0000-0000-0000-000000000004',
          'placement', 2,
          'score', 42,
          'is_winner', false
        )
      )
    )
  $$,
  '65. owner can update own play through RPC'
);

select results_eq(
  $$
    select
      array_agg(user_id::text order by user_id),
      count(*)::bigint
    from public.play_participants
    where play_id = '50000000-0000-0000-0000-000000000001'
  $$,
  $$
    values (
      array[
        '10000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000004'
      ]::text[],
      2::bigint
    )
  $$,
  '66. owner update replaces participant set exactly'
);

select throws_ok(
  $$
    select public.create_play_with_participants(
      '30000000-0000-0000-0000-000000000001',
      now(),
      null,
      45,
      'RPC create without participants',
      '[]'::jsonb
    )
  $$,
  '23514',
  null,
  '67. create RPC rejects zero participants'
);

select throws_ok(
  $$
    select public.create_play_with_participants(
      '30000000-0000-0000-0000-000000000001',
      now(),
      null,
      45,
      'RPC create without winner',
      jsonb_build_array(
        jsonb_build_object(
          'user_id', '10000000-0000-0000-0000-000000000002',
          'placement', 1,
          'score', 40,
          'is_winner', false
        )
      )
    )
  $$,
  '23514',
  null,
  '68. create RPC rejects zero winners'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    select public.update_play_with_participants(
      '50000000-0000-0000-0000-000000000002',
      '30000000-0000-0000-0000-000000000003',
      now(),
      null,
      70,
      'RPC update denied',
      jsonb_build_array(
        jsonb_build_object(
          'user_id', '10000000-0000-0000-0000-000000000003',
          'placement', 1,
          'score', 40,
          'is_winner', true
        )
      )
    )
  $$,
  '42501',
  null,
  '69. different member cannot update someone else play through RPC'
);

select results_eq(
  $$
    select
      array_agg(user_id::text order by user_id),
      count(*)::bigint
    from public.play_participants
    where play_id = '50000000-0000-0000-0000-000000000002'
  $$,
  $$
    values (
      array[
        '10000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000005'
      ]::text[],
      2::bigint
    )
  $$,
  '70. denied foreign update leaves participant set unchanged'
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
    select public.update_play_with_participants(
      '50000000-0000-0000-0000-000000000002',
      '30000000-0000-0000-0000-000000000003',
      now(),
      null,
      71,
      'RPC update admin',
      jsonb_build_array(
        jsonb_build_object(
          'user_id', '10000000-0000-0000-0000-000000000001',
          'placement', 1,
          'score', 48,
          'is_winner', true
        ),
        jsonb_build_object(
          'user_id', '10000000-0000-0000-0000-000000000003',
          'placement', 2,
          'score', 35,
          'is_winner', false
        )
      )
    )
  $$,
  '71. admin can update any play through RPC'
);

select results_eq(
  $$
    select
      array_agg(user_id::text order by user_id),
      count(*)::bigint
    from public.play_participants
    where play_id = '50000000-0000-0000-0000-000000000002'
  $$,
  $$
    values (
      array[
        '10000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000003'
      ]::text[],
      2::bigint
    )
  $$,
  '72. admin update replaces foreign participant set exactly'
);

reset role;

select results_eq(
  $$
    select action_type, private.point_reward_for(action_type)
    from unnest(array[
      'shelf_first_game',
      'shelf_5_games',
      'shelf_10_games',
      'shelf_15_games',
      'meeting_rsvp',
      'meeting_vote',
      'meeting_created',
      'rating_created',
      'play_logged'
    ]) as rewards(action_type)
    order by action_type
  $$,
  $$
    values
      ('meeting_created', 25),
      ('meeting_rsvp', 10),
      ('meeting_vote', 10),
      ('play_logged', 40),
      ('rating_created', 30),
      ('shelf_10_games', 20),
      ('shelf_15_games', 15),
      ('shelf_5_games', 30),
      ('shelf_first_game', 40)
  $$,
  '73. point reward catalog returns fixed values for every allowed action'
);

select throws_ok(
  $$select private.point_reward_for('unknown_reward')$$,
  '22023',
  null,
  '74. point reward catalog rejects an unknown action type'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.award_points_once(uuid,text,text,uuid,text,uuid)',
    'execute'
  ),
  '75. authenticated cannot execute the generic point award helper'
);

select results_eq(
  $$
    select awarded, points, point_event_id is not null
    from private.award_points_once(
      '10000000-0000-0000-0000-000000000002',
      'shelf_first_game',
      'profile',
      '10000000-0000-0000-0000-000000000002',
      'Pierwsza gra testowa',
      null
    )
  $$,
  $$values (true, 40, true)$$,
  '76. award_points_once returns an awarded event with catalog points'
);

select results_eq(
  $$
    select points, action_type, related_entity_type, created_by
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
      and action_type = 'shelf_first_game'
  $$,
  $$
    values (
      40,
      'shelf_first_game',
      'profile',
      '10000000-0000-0000-0000-000000000002'::uuid
    )
  $$,
  '77. awarded event stores fixed points relation and recipient as fallback actor'
);

select results_eq(
  $$
    select awarded, points, point_event_id is null
    from private.award_points_once(
      '10000000-0000-0000-0000-000000000002',
      'shelf_first_game',
      'profile',
      '10000000-0000-0000-0000-000000000002',
      'Powtórzona pierwsza gra',
      null
    )
  $$,
  $$values (false, 40, true)$$,
  '78. repeated award reports a harmless idempotent no-op'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
      and action_type = 'shelf_first_game'
      and related_entity_type = 'profile'
      and related_entity_id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$values (1::bigint)$$,
  '79. repeated award creates exactly one point event'
);

select results_eq(
  $$
    select awarded
    from private.award_points_once(
      '10000000-0000-0000-0000-000000000002',
      'shelf_5_games',
      'profile',
      '10000000-0000-0000-0000-000000000002',
      null,
      null
    )
  $$,
  $$values (true)$$,
  '80. different action types are allowed for the same related entity'
);

select results_eq(
  $$
    select awarded
    from private.award_points_once(
      '10000000-0000-0000-0000-000000000002',
      'meeting_rsvp',
      'meeting',
      '81000000-0000-0000-0000-000000000001',
      null,
      null
    )
  $$,
  $$values (true)$$,
  '81. an action type can be awarded for the first related entity'
);

select results_eq(
  $$
    select awarded
    from private.award_points_once(
      '10000000-0000-0000-0000-000000000002',
      'meeting_rsvp',
      'meeting',
      '81000000-0000-0000-0000-000000000002',
      null,
      null
    )
  $$,
  $$values (true)$$,
  '82. the same action type is allowed for a different related entity'
);

select throws_ok(
  $$
    insert into public.point_events (
      user_id,
      points,
      action_type,
      related_entity_type,
      related_entity_id,
      created_by
    ) values (
      '10000000-0000-0000-0000-000000000002',
      40,
      'shelf_first_game',
      'profile',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001'
    )
  $$,
  '23505',
  null,
  '83. unique index rejects an exact automatic point event duplicate'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    insert into public.point_events (
      user_id,
      points,
      action_type,
      description,
      related_entity_type,
      related_entity_id,
      created_by
    ) values
      (
        '10000000-0000-0000-0000-000000000002',
        1,
        'admin_adjustment',
        'Pierwsza korekta tej samej encji',
        'game',
        '82000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001'
      ),
      (
        '10000000-0000-0000-0000-000000000002',
        1,
        'admin_adjustment',
        'Druga korekta tej samej encji',
        'game',
        '82000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001'
      ),
      (
        '10000000-0000-0000-0000-000000000002',
        1,
        'manual_test',
        'Pierwszy manualny wpis bez encji',
        null,
        null,
        '10000000-0000-0000-0000-000000000001'
      ),
      (
        '10000000-0000-0000-0000-000000000002',
        1,
        'manual_test',
        'Drugi manualny wpis bez encji',
        null,
        null,
        '10000000-0000-0000-0000-000000000001'
      )
  $$,
  '84. admin adjustments and manual events without relation remain repeatable'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
      and action_type in ('admin_adjustment', 'manual_test')
  $$,
  $$values (4::bigint)$$,
  '85. partial unique index leaves four repeatable admin and manual events'
);
reset role;

select throws_ok(
  $$
    select *
    from private.award_points_once(
      '10000000-0000-0000-0000-000000000006',
      'meeting_rsvp',
      'meeting',
      '81000000-0000-0000-0000-000000000003',
      null,
      null
    )
  $$,
  '42501',
  null,
  '86. award_points_once rejects an inactive recipient'
);

select throws_ok(
  $$
    update public.point_events
    set points = 999
    where user_id = '10000000-0000-0000-0000-000000000002'
      and action_type = 'shelf_first_game'
  $$,
  '42501',
  null,
  '87. automatic point events remain append-only'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select total_points from public.user_point_balances$$,
  $$values (1174::bigint)$$,
  '88. user point balance includes idempotent awards and repeatable corrections'
);

select results_eq(
  $$
    select total_points
    from public.get_leaderboard()
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$values (1174::bigint)$$,
  '89. leaderboard includes the same updated ledger balance'
);
reset role;

select results_eq(
  $$
    select pronargs
    from pg_proc
    where oid = 'public.award_shelf_onboarding_points()'::regprocedure
  $$,
  $$values (0::smallint)$$,
  '90. shelf onboarding RPC accepts neither user id nor points'
);

set local role anon;
select throws_ok(
  $$select * from public.award_shelf_onboarding_points()$$,
  '42501',
  null,
  '91. anonymous user cannot execute shelf onboarding award RPC'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.award_shelf_onboarding_points()$$,
  '42501',
  null,
  '92. inactive member cannot award shelf onboarding points'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.games (
  id,
  title,
  owner_id,
  current_holder_id,
  min_players,
  max_players,
  status,
  archived_at
) values (
  '74000000-0000-0000-0000-000000000099',
  'Zarchiwizowana gra onboardingowa',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000004',
  1,
  4,
  'available',
  now()
);

select results_eq(
  $$select * from public.award_shelf_onboarding_points()$$,
  $$values (0, 0)$$,
  '93. zero active games earns no points and archived games do not count'
);

insert into public.games (
  id,
  title,
  owner_id,
  current_holder_id,
  min_players,
  max_players,
  status
) values (
  '74000000-0000-0000-0000-000000000001',
  'Gra onboardingowa 1',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000004',
  1,
  4,
  'available'
);

select results_eq(
  $$select * from public.award_shelf_onboarding_points()$$,
  $$values (1, 40)$$,
  '94. first active game awards shelf_first_game once'
);

select results_eq(
  $$
    select action_type, points, related_entity_type, related_entity_id
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000004'
      and action_type = 'shelf_first_game'
  $$,
  $$
    values (
      'shelf_first_game',
      40,
      'profile',
      '10000000-0000-0000-0000-000000000004'::uuid
    )
  $$,
  '95. first shelf milestone stores the fixed event contract'
);

insert into public.games (
  id,
  title,
  owner_id,
  current_holder_id,
  min_players,
  max_players,
  status
)
select
  ('74000000-0000-0000-0000-' || lpad(game_number::text, 12, '0'))::uuid,
  'Gra onboardingowa ' || game_number,
  '10000000-0000-0000-0000-000000000004'::uuid,
  '10000000-0000-0000-0000-000000000004'::uuid,
  1,
  4,
  'available'::public.game_status
from generate_series(2, 5) as game_number;

select results_eq(
  $$select * from public.award_shelf_onboarding_points()$$,
  $$values (1, 30)$$,
  '96. five active games award shelf_5_games once'
);

insert into public.games (
  id,
  title,
  owner_id,
  current_holder_id,
  min_players,
  max_players,
  status
)
select
  ('74000000-0000-0000-0000-' || lpad(game_number::text, 12, '0'))::uuid,
  'Gra onboardingowa ' || game_number,
  '10000000-0000-0000-0000-000000000004'::uuid,
  '10000000-0000-0000-0000-000000000004'::uuid,
  1,
  4,
  'available'::public.game_status
from generate_series(6, 10) as game_number;

select results_eq(
  $$select * from public.award_shelf_onboarding_points()$$,
  $$values (1, 20)$$,
  '97. ten active games award shelf_10_games once'
);

insert into public.games (
  id,
  title,
  owner_id,
  current_holder_id,
  min_players,
  max_players,
  status
)
select
  ('74000000-0000-0000-0000-' || lpad(game_number::text, 12, '0'))::uuid,
  'Gra onboardingowa ' || game_number,
  '10000000-0000-0000-0000-000000000004'::uuid,
  '10000000-0000-0000-0000-000000000004'::uuid,
  1,
  4,
  'available'::public.game_status
from generate_series(11, 15) as game_number;

select results_eq(
  $$select * from public.award_shelf_onboarding_points()$$,
  $$values (1, 15)$$,
  '98. fifteen active games award shelf_15_games once'
);

select results_eq(
  $$
    select
      award.awarded_count,
      award.awarded_points,
      (
        select count(*)::integer
        from public.point_events
        where user_id = '10000000-0000-0000-0000-000000000004'
          and action_type in (
            'shelf_first_game',
            'shelf_5_games',
            'shelf_10_games',
            'shelf_15_games'
          )
      )
    from public.award_shelf_onboarding_points() as award
  $$,
  $$values (0, 0, 4)$$,
  '99. repeated shelf award call is an idempotent no-op'
);

select results_eq(
  $$select total_points from public.user_point_balances$$,
  $$values (915::bigint)$$,
  '100. user point balance includes all four shelf milestones exactly once'
);
reset role;

select * from finish();
rollback;
