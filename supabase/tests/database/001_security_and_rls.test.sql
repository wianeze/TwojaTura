begin;

create extension if not exists pgtap with schema extensions;
select plan(309);

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
  $$values (4::bigint)$$,
  '33. active member sees the limited global leaderboard (admin excluded per role system)'
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
  exists (
    select 1 from public.profiles
    where id = '90000000-0000-0000-0000-000000000002'
      and display_name = 'Bez Zaproszenia'
  ),
  '46. unmarked auth user is provisioned too (twoja_tura_invite is no longer required)'
);

select results_eq(
  $$select role from public.app_members where user_id = '90000000-0000-0000-0000-000000000002'$$,
  $$values ('member'::public.membership_role)$$,
  '46a. unmarked auth user provisioning still assigns member role'
);

select results_eq(
  $$select is_active from public.app_members where user_id = '90000000-0000-0000-0000-000000000002'$$,
  $$values (true)$$,
  '46b. unmarked auth user provisioning still activates membership'
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
-- Kontrakt zmieniony wraz z silnikiem przeliczania nagród: mutacje partii
-- przez RPC (create/update/delete) przyznają nagrody w TEJ SAMEJ transakcji,
-- zamiast polegać na osobnych wywołaniach z warstwy TS. Testy 63 i 65 tworzą i
-- edytują partie tego użytkownika, więc jego saldo zawiera teraz dodatkowo
-- punkty za zapis partii utworzonej przez RPC oraz odznaki uczestnikowe.
-- Punkty za partie sprzed wdrożenia (legacy-untracked) NIE są doliczane —
-- pilnuje tego test 89a poniżej.
select results_eq(
  $$select total_points from public.user_point_balances$$,
  $$values (1249::bigint)$$,
  '88. user point balance includes idempotent awards and repeatable corrections'
);

select results_eq(
  $$
    select total_points
    from public.get_leaderboard()
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$values (1249::bigint)$$,
  '89. leaderboard includes the same updated ledger balance'
);
reset role;

-- Straż modelu legacy: partie z seeda istniały przed wdrożeniem silnika, więc
-- mają rewards_managed = false i nigdy nie mogą dostać punktów za zapis z mocą
-- wsteczną — nawet po edycji przez RPC (test 65 edytuje partię 5000...0001).
select results_eq(
  $$
    select count(*)::bigint
    from public.point_events
    where action_type = 'play_logged'
      and related_entity_id in (
        '50000000-0000-0000-0000-000000000001',
        '50000000-0000-0000-0000-000000000002'
      )
  $$,
  $$values (0::bigint)$$,
  '89a. legacy plays never receive retroactive play_logged points'
);

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

select ok(
  (
    select count(*) = 2
      and bool_and(pronargs = 1)
      and bool_and(oidvectortypes(proargtypes) = 'uuid')
    from pg_proc
    where oid in (
      'public.award_meeting_rsvp_points(uuid)'::regprocedure,
      'public.award_meeting_vote_points(uuid)'::regprocedure
    )
  ),
  '101. meeting point RPCs accept only a meeting id'
);

set local role anon;
select throws_ok(
  $$select * from public.award_meeting_rsvp_points('40000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '102. anonymous user cannot execute meeting RSVP award RPC'
);

select throws_ok(
  $$select * from public.award_meeting_vote_points('40000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '103. anonymous user cannot execute meeting vote award RPC'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.award_meeting_rsvp_points('40000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '104. inactive member cannot award meeting RSVP points'
);

select throws_ok(
  $$select * from public.award_meeting_vote_points('40000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '105. inactive member cannot award meeting vote points'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.meetings (
  id,
  created_by,
  title,
  status,
  starts_at,
  ends_at
) values
  (
    '75000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000004',
    'Spotkanie punktowe pierwsze',
    'planned',
    '2026-09-01 16:00:00+00',
    '2026-09-01 20:00:00+00'
  ),
  (
    '75000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000004',
    'Spotkanie punktowe drugie',
    'planned',
    '2026-09-08 16:00:00+00',
    '2026-09-08 20:00:00+00'
  );

insert into public.meeting_availability (meeting_id, user_id, is_available)
values (
  '75000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004',
  true
);

select results_eq(
  $$
    select awarded, points, point_event_id is not null
    from public.award_meeting_rsvp_points(
      '75000000-0000-0000-0000-000000000001'
    )
  $$,
  $$values (true, 10, true)$$,
  '106. first saved RSVP awards meeting_rsvp points once'
);

update public.meeting_availability
set is_available = false
where meeting_id = '75000000-0000-0000-0000-000000000001'
  and user_id = '10000000-0000-0000-0000-000000000004';

select results_eq(
  $$
    select
      award.awarded,
      award.points,
      (
        select count(*)::integer
        from public.point_events
        where user_id = '10000000-0000-0000-0000-000000000004'
          and action_type = 'meeting_rsvp'
          and related_entity_id = '75000000-0000-0000-0000-000000000001'
      )
    from public.award_meeting_rsvp_points(
      '75000000-0000-0000-0000-000000000001'
    ) as award
  $$,
  $$values (false, 10, 1)$$,
  '107. changing RSVP does not duplicate meeting_rsvp points'
);

insert into public.meeting_availability (meeting_id, user_id, is_available)
values (
  '75000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000004',
  false
);

select results_eq(
  $$
    select awarded, points
    from public.award_meeting_rsvp_points(
      '75000000-0000-0000-0000-000000000002'
    )
  $$,
  $$values (true, 10)$$,
  '108. first unavailable RSVP also qualifies for meeting_rsvp points'
);

insert into public.meeting_game_votes (meeting_id, game_id, user_id)
values (
  '75000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004'
);

select results_eq(
  $$
    select awarded, points, point_event_id is not null
    from public.award_meeting_vote_points(
      '75000000-0000-0000-0000-000000000001'
    )
  $$,
  $$values (true, 10, true)$$,
  '109. first saved game vote awards meeting_vote points once'
);

insert into public.meeting_game_votes (meeting_id, game_id, user_id)
values (
  '75000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000004'
);

select results_eq(
  $$
    select
      award.awarded,
      award.points,
      (
        select count(*)::integer
        from public.point_events
        where user_id = '10000000-0000-0000-0000-000000000004'
          and action_type = 'meeting_vote'
          and related_entity_id = '75000000-0000-0000-0000-000000000001'
      )
    from public.award_meeting_vote_points(
      '75000000-0000-0000-0000-000000000001'
    ) as award
  $$,
  $$values (false, 10, 1)$$,
  '110. several votes in one meeting do not duplicate meeting_vote points'
);

insert into public.meeting_game_votes (meeting_id, game_id, user_id)
values (
  '75000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004'
);

select results_eq(
  $$
    select awarded, points
    from public.award_meeting_vote_points(
      '75000000-0000-0000-0000-000000000002'
    )
  $$,
  $$values (true, 10)$$,
  '111. the same user can earn meeting_vote for another meeting'
);

select results_eq(
  $$select total_points from public.user_point_balances$$,
  $$values (955::bigint)$$,
  '112. user point balance includes RSVP and vote rewards exactly once'
);

select throws_ok(
  $$
    update public.point_events
    set points = 999
    where user_id = '10000000-0000-0000-0000-000000000004'
      and action_type = 'meeting_rsvp'
  $$,
  '42501',
  null,
  '113. meeting point events remain append-only'
);
reset role;

select ok(
  (
    select count(*) = 2
      and bool_and(pronargs = 1)
      and bool_and(oidvectortypes(proargtypes) = 'uuid')
    from pg_proc
    where oid in (
      'public.award_rating_created_points(uuid)'::regprocedure,
      'public.award_play_logged_points(uuid)'::regprocedure
    )
  ),
  '114. rating and play point RPCs accept only one related entity id'
);

set local role anon;
select throws_ok(
  $$select * from public.award_rating_created_points('30000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '115. anonymous user cannot execute rating award RPC'
);

select throws_ok(
  $$select * from public.award_play_logged_points('50000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '116. anonymous user cannot execute play award RPC'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.award_rating_created_points('30000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '117. inactive member cannot award rating points'
);

select throws_ok(
  $$select * from public.award_play_logged_points('50000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '118. inactive member cannot award play points'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select * from public.award_rating_created_points('74000000-0000-0000-0000-000000000003')$$,
  '22023',
  null,
  '119. rating points require the current user own rating for the game'
);

insert into public.ratings (
  game_id,
  user_id,
  overall,
  replayability,
  theme,
  wants_to_play_again
) values (
  '74000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004',
  8,
  7,
  9,
  true
);

select results_eq(
  $$
    select awarded, points, point_event_id is not null
    from public.award_rating_created_points(
      '74000000-0000-0000-0000-000000000001'
    )
  $$,
  $$values (true, 30, true)$$,
  '120. first own rating awards rating_created points once'
);

select results_eq(
  $$
    select
      award.awarded,
      award.points,
      (
        select count(*)::integer
        from public.point_events
        where user_id = '10000000-0000-0000-0000-000000000004'
          and action_type = 'rating_created'
          and related_entity_id = '74000000-0000-0000-0000-000000000001'
      )
    from public.award_rating_created_points(
      '74000000-0000-0000-0000-000000000001'
    ) as award
  $$,
  $$values (false, 30, 1)$$,
  '121. repeated rating award call does not duplicate points'
);

insert into public.ratings (
  game_id,
  user_id,
  overall,
  replayability,
  theme,
  wants_to_play_again
) values (
  '74000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000004',
  7,
  7,
  8,
  false
);

select results_eq(
  $$
    select awarded, points
    from public.award_rating_created_points(
      '74000000-0000-0000-0000-000000000002'
    )
  $$,
  $$values (true, 30)$$,
  '122. the same user can earn rating_created for another game'
);

insert into public.plays (
  id,
  game_id,
  created_by,
  played_at,
  duration_minutes,
  comment
) values (
  '77000000-0000-0000-0000-000000000001',
  '74000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004',
  '2026-09-15 18:00:00+00',
  90,
  'Partia testowa nagrody Kroniki'
);

select results_eq(
  $$
    select awarded, points, point_event_id is not null
    from public.award_play_logged_points(
      '77000000-0000-0000-0000-000000000001'
    )
  $$,
  $$values (true, 40, true)$$,
  '123. active play author earns play_logged points once'
);

select results_eq(
  $$
    select
      award.awarded,
      award.points,
      (
        select count(*)::integer
        from public.point_events
        where user_id = '10000000-0000-0000-0000-000000000004'
          and action_type = 'play_logged'
          and related_entity_id = '77000000-0000-0000-0000-000000000001'
      )
    from public.award_play_logged_points(
      '77000000-0000-0000-0000-000000000001'
    ) as award
  $$,
  $$values (false, 40, 1)$$,
  '124. repeated play award call does not duplicate points'
);

select throws_ok(
  $$select * from public.award_play_logged_points('50000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '125. member cannot earn play_logged for another author play'
);

select results_eq(
  $$select total_points from public.user_point_balances$$,
  $$values (1055::bigint)$$,
  '126. user point balance includes rating and play rewards exactly once'
);

select throws_ok(
  $$
    update public.point_events
    set points = 999
    where user_id = '10000000-0000-0000-0000-000000000004'
      and action_type in ('rating_created', 'play_logged')
  $$,
  '42501',
  null,
  '127. rating and play point events remain append-only'
);
reset role;

select results_eq(
  $$
    select pronargs, oidvectortypes(proargtypes)
    from pg_proc
    where oid = 'public.award_meeting_created_points(uuid)'::regprocedure
  $$,
  $$values (1::smallint, 'uuid')$$,
  '128. meeting created award RPC accepts only a meeting id'
);

set local role anon;
select throws_ok(
  $$select * from public.award_meeting_created_points('40000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '129. anonymous user cannot execute meeting created award RPC'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.award_meeting_created_points('40000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '130. inactive member cannot award meeting created points'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$
    select awarded, points, point_event_id is not null
    from public.award_meeting_created_points(
      '75000000-0000-0000-0000-000000000001'
    )
  $$,
  $$values (true, 25, true)$$,
  '131. active meeting author earns meeting_created points once'
);

select results_eq(
  $$
    select
      award.awarded,
      award.points,
      (
        select count(*)::integer
        from public.point_events
        where user_id = '10000000-0000-0000-0000-000000000004'
          and action_type = 'meeting_created'
          and related_entity_id = '75000000-0000-0000-0000-000000000001'
      )
    from public.award_meeting_created_points(
      '75000000-0000-0000-0000-000000000001'
    ) as award
  $$,
  $$values (false, 25, 1)$$,
  '132. repeated meeting created award call does not duplicate points'
);

select throws_ok(
  $$select * from public.award_meeting_created_points('40000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '133. member cannot earn meeting_created for another author meeting'
);

select results_eq(
  $$select total_points from public.user_point_balances$$,
  $$values (1080::bigint)$$,
  '134. user point balance includes meeting created reward exactly once'
);

select throws_ok(
  $$
    update public.point_events
    set points = 999
    where user_id = '10000000-0000-0000-0000-000000000004'
      and action_type = 'meeting_created'
  $$,
  '42501',
  null,
  '135. meeting created point events remain append-only'
);
reset role;

select has_table(
  'public',
  'achievement_definitions',
  '136. achievement definitions table exists'
);

select has_table(
  'public',
  'user_achievements',
  '137. user achievements table exists'
);

select has_table(
  'public',
  'class_definitions',
  '138. class definitions table exists'
);

select has_table(
  'public',
  'class_requirements',
  '139. class requirements table exists'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_class
    where oid in (
      'public.achievement_definitions'::regclass,
      'public.user_achievements'::regclass,
      'public.class_definitions'::regclass,
      'public.class_requirements'::regclass
    )
      and relrowsecurity = true
  $$,
  $$values (4::bigint)$$,
  '140. RLS is enabled on all achievement and class tables'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_constraint
    where conrelid in (
      'public.achievement_definitions'::regclass,
      'public.user_achievements'::regclass,
      'public.class_definitions'::regclass,
      'public.class_requirements'::regclass
    )
      and contype = 'p'
  $$,
  $$values (4::bigint)$$,
  '141. all achievement and class tables have primary keys'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_constraint
    where conrelid in (
      'public.user_achievements'::regclass,
      'public.class_requirements'::regclass
    )
      and contype = 'f'
  $$,
  $$values (5::bigint)$$,
  '142. user achievements and class requirements have all foreign keys'
);

insert into public.user_achievements (user_id, achievement_key)
values ('10000000-0000-0000-0000-000000000002', 'natural_one');

select throws_ok(
  $$
    insert into public.user_achievements (user_id, achievement_key)
    values ('10000000-0000-0000-0000-000000000002', 'natural_one')
  $$,
  '23505',
  null,
  '143. user achievements reject duplicate user and achievement key'
);

select throws_ok(
  $$
    insert into public.class_requirements (class_key, achievement_key)
    values ('paladyn_zasad', 'rule_quard')
  $$,
  '23505',
  null,
  '144. class requirements reject duplicate class and achievement key'
);

select results_eq(
  $$select count(*)::bigint from public.achievement_definitions where is_active = true$$,
  $$values (51::bigint)$$,
  '145. seed contains 51 active achievement definitions'
);

select results_eq(
  $$select count(*)::bigint from public.class_definitions where is_active = true$$,
  $$values (14::bigint)$$,
  '146. seed contains 14 active class definitions'
);

select results_eq(
  $$select count(*)::bigint from public.class_requirements$$,
  $$values (70::bigint)$$,
  '147. seed contains all 70 class requirements'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.class_requirements as requirement
    left join public.class_definitions as class
      on class.class_key = requirement.class_key
    left join public.achievement_definitions as achievement
      on achievement.achievement_key = requirement.achievement_key
    where class.class_key is null or achievement.achievement_key is null
  $$,
  $$values (0::bigint)$$,
  '148. every class requirement references seeded definitions'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.achievement_definitions
    where rarity not in ('common', 'rare', 'epic', 'legendary', 'secret')
      or automation_status not in ('automatic', 'manual', 'planned', 'secret')
  $$,
  $$values (0::bigint)$$,
  '149. achievement rarity and automation status use the allowed catalogs'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.achievement_definitions
    where (rarity = 'secret') is distinct from is_secret
  $$,
  $$values (0::bigint)$$,
  '150. secret rarity definitions are marked secret'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.achievement_definitions
    where (automation_status = 'manual') is distinct from is_manual
  $$,
  $$values (0::bigint)$$,
  '151. manual definitions are marked manual'
);

set local role anon;
select throws_ok(
  $$select * from public.achievement_definitions$$,
  '42501',
  null,
  '152. anonymous user cannot read achievement definitions'
);
select throws_ok(
  $$select * from public.user_achievements$$,
  '42501',
  null,
  '153. anonymous user cannot read user achievements'
);
select throws_ok(
  $$select * from public.class_definitions$$,
  '42501',
  null,
  '154. anonymous user cannot read class definitions'
);
select throws_ok(
  $$select * from public.class_requirements$$,
  '42501',
  null,
  '155. anonymous user cannot read class requirements'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$
    select
      (select count(*) from public.achievement_definitions),
      (select count(*) from public.user_achievements),
      (select count(*) from public.class_definitions),
      (select count(*) from public.class_requirements)
  $$,
  $$values (0::bigint, 0::bigint, 0::bigint, 0::bigint)$$,
  '156. inactive member cannot read achievement or class data'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.achievement_definitions$$,
  $$values (45::bigint)$$,
  '157. active member reads active non-secret achievement definitions'
);
select results_eq(
  $$select count(*)::bigint from public.class_definitions$$,
  $$values (14::bigint)$$,
  '158. active member reads active class definitions'
);
select throws_ok(
  $$
    insert into public.achievement_definitions (
      achievement_key, name, description, condition_text, rarity,
      automation_status, sort_order
    ) values (
      'member_created', 'Niedozwolona', 'Niedozwolona', 'Niedozwolona',
      'common', 'planned', 999
    )
  $$,
  '42501',
  null,
  '159. active member cannot insert achievement definitions'
);
select results_eq(
  $$
    with changed as (
      update public.achievement_definitions
      set points = 999
      where achievement_key = 'critical_roll'
      returning 1
    )
    select count(*)::bigint from changed
  $$,
  $$values (0::bigint)$$,
  '160. active member cannot update achievement definitions'
);
select results_eq(
  $$
    with removed as (
      delete from public.class_requirements
      where class_key = 'paladyn_zasad'
        and achievement_key = 'rule_quard'
      returning 1
    )
    select count(*)::bigint from removed
  $$,
  $$values (0::bigint)$$,
  '161. active member cannot delete class requirements'
);
select throws_ok(
  $$
    insert into public.user_achievements (user_id, achievement_key)
    values ('10000000-0000-0000-0000-000000000002', 'critical_roll')
  $$,
  '42501',
  null,
  '162. active member cannot award an achievement to themselves'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.achievement_definitions$$,
  $$values (51::bigint)$$,
  '163. admin reads all achievement definitions including secrets'
);
-- Liczba wzrosła, bo przeliczanie przyznaje odznaki uczestnikowe wszystkim
-- uprawnionym graczom partii, a nie tylko osobie zapisującej wpis (decyzja
-- właściciela z 2026-07-29). Test sprawdza uprawnienie admina do odczytu, a nie
-- konkretną wartość licznika.
select results_eq(
  $$select count(*)::bigint from public.user_achievements$$,
  $$values (7::bigint)$$,
  '164. admin reads awarded achievements'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$
    select count(*)::bigint
    from public.achievement_definitions
    where achievement_key = 'dice_speak'
  $$,
  $$values (0::bigint)$$,
  '165. active member cannot see an unearned secret definition'
);
reset role;

select results_eq(
  $$
    select awarded, achievement_key, awarded_at is not null
    from private.award_achievement_once(
      '10000000-0000-0000-0000-000000000002',
      'dice_speak',
      'test',
      '81000000-0000-0000-0000-000000000001'
    )
  $$,
  $$values (true, 'dice_speak', true)$$,
  '166. helper can award a secret achievement to an active user'
);

set local role authenticated;
select results_eq(
  $$
    select count(*)::bigint
    from public.achievement_definitions
    where achievement_key = 'dice_speak'
  $$,
  $$values (1::bigint)$$,
  '167. active member sees their own earned secret definition'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
do $$
begin
  perform * from private.award_achievement_once(
    '10000000-0000-0000-0000-000000000004',
    'friendly_fire',
    'test',
    '81000000-0000-0000-0000-000000000002'
  );
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$
    select count(*)::bigint
    from public.user_achievements
    where user_id = '10000000-0000-0000-0000-000000000004'
      and achievement_key = 'friendly_fire'
  $$,
  $$values (0::bigint)$$,
  '168. another member secret achievement is not exposed'
);
reset role;

create temporary table pgtap_achievement_points_before as
select
  count(*)::bigint as event_count,
  coalesce(sum(points), 0)::bigint as total_points
from public.point_events
where user_id = '10000000-0000-0000-0000-000000000002';

-- Nośnik zmieniony z 'critical_roll' na 'bag_of_holding'. Te testy sprawdzają
-- MECHANIKĘ helpera (pierwsze przyznanie, brak duplikatu, jedno zdarzenie
-- punktowe), a nie konkretną odznakę. 'critical_roll' przestał się nadawać, bo
-- należy do domeny 'play' i jest teraz przyznawany wcześniej przez
-- przeliczanie — pierwsze wywołanie helpera nigdy nie byłoby już „pierwsze”.
-- 'bag_of_holding' należy do domeny 'collection', więc pozostaje poza zakresem
-- przeliczania wywołanego zmianą partii i nie jest osiągalny dla tego
-- użytkownika żadną inną ścieżką w tym pliku.
select results_eq(
  $$
    select awarded, achievement_key, awarded_at is not null
    from private.award_achievement_once(
      '10000000-0000-0000-0000-000000000002',
      'bag_of_holding',
      'test',
      '81000000-0000-0000-0000-000000000003'
    )
  $$,
  $$values (true, 'bag_of_holding', true)$$,
  '169. helper awards an active definition to an active user'
);

select results_eq(
  $$
    select awarded, achievement_key, awarded_at is null
    from private.award_achievement_once(
      '10000000-0000-0000-0000-000000000002',
      'bag_of_holding',
      'repeat',
      '81000000-0000-0000-0000-000000000004'
    )
  $$,
  $$values (false, 'bag_of_holding', true)$$,
  '170. helper does not duplicate an earned achievement'
);

update public.achievement_definitions
set is_active = false
where achievement_key = 'hot_streak';

select throws_ok(
  $$
    select * from private.award_achievement_once(
      '10000000-0000-0000-0000-000000000002',
      'hot_streak'
    )
  $$,
  '22023',
  null,
  '171. helper rejects an inactive achievement definition'
);

update public.achievement_definitions
set is_active = true
where achievement_key = 'hot_streak';

select throws_ok(
  $$
    select * from private.award_achievement_once(
      '10000000-0000-0000-0000-000000000002',
      'missing_achievement'
    )
  $$,
  '22023',
  null,
  '172. helper rejects an unknown achievement definition'
);

select throws_ok(
  $$
    select * from private.award_achievement_once(
      '10000000-0000-0000-0000-000000000006',
      'critical_roll'
    )
  $$,
  '42501',
  null,
  '173. helper rejects an inactive achievement recipient'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$select event_count + 1 from pgtap_achievement_points_before$$,
  '174. first achievement award creates one point event'
);

select results_eq(
  $$
    select coalesce(sum(points), 0)::bigint
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  -- 30 zamiast 5: wartość wynika z definicji nośnika ('bag_of_holding'),
  -- zmienionego w teście 169 z powodów opisanych tam.
  $$select total_points + 30 from pgtap_achievement_points_before$$,
  '175. first achievement award adds definition points to the user balance'
);

select is(
  has_function_privilege(
    'anon',
    'private.award_achievement_once(uuid,text,text,uuid,text,uuid)',
    'EXECUTE'
  ),
  false,
  '176. anonymous role cannot execute the achievement award helper'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.award_achievement_once(uuid,text,text,uuid,text,uuid)',
    'EXECUTE'
  ),
  false,
  '177. authenticated role cannot execute the achievement award helper directly'
);

set local role authenticated;
select throws_ok(
  $$
    update public.user_achievements
    set note = 'Niedozwolona zmiana'
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  '42501',
  null,
  '178. active member cannot update earned achievements'
);
select throws_ok(
  $$
    delete from public.user_achievements
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  '42501',
  null,
  '179. active member cannot delete earned achievements'
);
reset role;

select results_eq(
  $$
    select action_type, description, points, related_entity_type
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
      and action_type = 'achievement_unlocked:critical_roll'
  $$,
  $$values ('achievement_unlocked:critical_roll', 'Odznaka: Rzut Krytyczny', 5, 'profile')$$,
  '180. achievement point event uses the definition reward and readable metadata'
);

insert into public.achievement_definitions (
  achievement_key,
  name,
  description,
  condition_text,
  rarity,
  points,
  automation_status,
  sort_order
)
values (
  'pgtap_zero_points',
  'Test bez punktów',
  'Definicja testowa bez punktów.',
  'Warunek testowy.',
  'common',
  0,
  'planned',
  1000
);

select results_eq(
  $$
    select awarded, points_awarded, point_event_id is null
    from private.award_achievement_once(
      '10000000-0000-0000-0000-000000000002',
      'pgtap_zero_points',
      'test'
    )
  $$,
  $$values (true, 0, true)$$,
  '181. zero-point achievement is awarded without a point event'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
      and action_type = 'achievement_unlocked:pgtap_zero_points'
  $$,
  $$values (0::bigint)$$,
  '182. zero-point achievement leaves the point ledger unchanged'
);

set local role anon;
select throws_ok(
  $$select * from public.award_current_user_simple_achievements()$$,
  '42501',
  null,
  '183. anonymous role cannot run simple achievement automation'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.award_current_user_simple_achievements()$$,
  '42501',
  null,
  '184. inactive member cannot run simple achievement automation'
);
reset role;

create temporary table pgtap_simple_achievement_balance_before as
select coalesce(sum(points), 0)::bigint as total_points
from public.point_events
where user_id = '10000000-0000-0000-0000-000000000005';

grant select
on table pgtap_simple_achievement_balance_before
to authenticated;

insert into public.games (
  id,
  title,
  owner_id,
  current_holder_id,
  status
)
select
  md5('simple-achievement-game-' || series.value)::uuid,
  'Simple achievement game ' || series.value,
  '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000005',
  'available'
from generate_series(1, 50) as series(value);

insert into public.meetings (
  id,
  created_by,
  title,
  status,
  starts_at,
  ends_at
)
select
  md5('simple-achievement-meeting-' || series.value)::uuid,
  '10000000-0000-0000-0000-000000000005',
  'Simple achievement meeting ' || series.value,
  'planned',
  '2026-08-01 16:00:00+00'::timestamptz + series.value * interval '1 day',
  '2026-08-01 20:00:00+00'::timestamptz + series.value * interval '1 day'
from generate_series(1, 10) as series(value);

insert into public.meeting_availability (meeting_id, user_id, is_available)
select
  md5('simple-achievement-meeting-' || series.value)::uuid,
  '10000000-0000-0000-0000-000000000005',
  series.value % 2 = 0
from generate_series(1, 10) as series(value);

insert into public.ratings (
  game_id,
  user_id,
  overall,
  replayability,
  theme,
  wants_to_play_again,
  comment
)
select
  md5('simple-achievement-game-' || series.value)::uuid,
  '10000000-0000-0000-0000-000000000005',
  case when series.value <= 5 then 10 else 8 end,
  8,
  8,
  true,
  case when series.value <= 10 then 'Komentarz ' || series.value else null end
from generate_series(1, 20) as series(value);

insert into public.plays (
  id,
  game_id,
  meeting_id,
  created_by,
  played_at,
  comment
)
select
  md5('simple-achievement-play-' || series.value)::uuid,
  md5('simple-achievement-game-' || (((series.value - 1) % 20) + 1))::uuid,
  null,
  '10000000-0000-0000-0000-000000000005',
  '2026-07-20 12:00:00+00'::timestamptz + (series.value / 3) * interval '1 day',
  'Simple achievement play ' || series.value
from generate_series(1, 25) as series(value);

insert into public.play_participants (
  play_id,
  user_id,
  placement,
  is_winner
)
select
  md5('simple-achievement-play-' || series.value)::uuid,
  '10000000-0000-0000-0000-000000000005',
  1,
  series.value = 1
from generate_series(1, 25) as series(value);

insert into public.play_participants (play_id, user_id, placement, is_winner)
values
  (md5('simple-achievement-play-2')::uuid, '10000000-0000-0000-0000-000000000001', 2, false),
  (md5('simple-achievement-play-2')::uuid, '10000000-0000-0000-0000-000000000002', 3, false),
  (md5('simple-achievement-play-2')::uuid, '10000000-0000-0000-0000-000000000003', 4, false),
  (md5('simple-achievement-play-2')::uuid, '10000000-0000-0000-0000-000000000004', 5, false);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$
    select awarded_count, points_awarded, cardinality(awarded_keys)
    from public.award_current_user_simple_achievements()
  $$,
  $$values (13, 140, 13)$$,
  '185. qualifying active member receives all 13 simple achievements and their points'
);

select ok(private.has_achievement('critical_roll'), '186. first win unlocks critical_roll');
select ok(private.has_achievement('initiative_master'), '187. five created meetings unlock initiative_master');
select ok(private.has_achievement('party_bard'), '188. ten rating comments unlock party_bard');
select ok(private.has_achievement('coast_chronicler'), '189. twenty-five created plays unlock coast_chronicler');
select ok(private.has_achievement('short_rest'), '190. two participations on one calendar day unlock short_rest');
select ok(private.has_achievement('full_party'), '191. participation in a five-player play unlocks full_party');
select ok(private.has_achievement('lone_wolf'), '192. participation in a solo play unlocks lone_wolf');
select ok(private.has_achievement('side_quest'), '193. spontaneous created play unlocks side_quest');
select ok(private.has_achievement('guidance'), '194. ten complete meeting responses unlock guidance');
select ok(private.has_achievement('loot_goblin'), '195. twenty-five active owned games unlock loot_goblin');
select ok(private.has_achievement('bag_of_holding'), '196. fifty active owned games unlock bag_of_holding');
select ok(private.has_achievement('fanboy'), '197. five distinct perfect ratings unlock fanboy');
select ok(private.has_achievement('one_more_turn'), '198. replay intent on twenty distinct games unlocks one_more_turn');

select results_eq(
  $$
    select awarded_count, points_awarded, cardinality(awarded_keys)
    from public.award_current_user_simple_achievements()
  $$,
  $$values (0, 0, 0)$$,
  '199. repeated automation call is idempotent'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.user_achievements
    where user_id = '10000000-0000-0000-0000-000000000005'
      and achievement_key not in (
        'critical_roll', 'initiative_master', 'party_bard', 'coast_chronicler',
        'short_rest', 'full_party', 'lone_wolf', 'side_quest', 'guidance',
        'loot_goblin', 'bag_of_holding', 'fanboy', 'one_more_turn'
      )
  $$,
  $$values (0::bigint)$$,
  '200. simple automation does not award manual secret or out-of-scope achievements'
);

select results_eq(
  $$
    select coalesce(sum(points), 0)::bigint
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000005'
  $$,
  $$select total_points + 140 from pgtap_simple_achievement_balance_before$$,
  '201. achievement rewards add exactly the definition point total to the balance'
);
reset role;

select results_eq(
  $$
    select pronargs::integer
    from pg_proc
    where oid = 'public.award_current_user_simple_achievements()'::regprocedure
  $$,
  $$values (0)$$,
  '202. public automation RPC accepts neither user id nor points'
);

insert into public.games (
  id,
  title,
  owner_id,
  current_holder_id,
  status,
  archived_at
)
select
  md5('archived-achievement-game-' || series.value)::uuid,
  'Archived achievement game ' || series.value,
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000004',
  'available',
  '2026-07-01 12:00:00+00'::timestamptz
from generate_series(1, 25) as series(value);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select * from public.award_current_user_simple_achievements()$$,
  '203. active member can run automation with only archived owned games'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.user_achievements
    where user_id = '10000000-0000-0000-0000-000000000004'
      and achievement_key in ('loot_goblin', 'bag_of_holding')
  $$,
  $$values (0::bigint)$$,
  '204. archived games do not count toward collection achievements'
);
reset role;

select is(
  private.point_reward_for('play_logged'),
  40,
  '205. achievement rewards do not change the existing activity reward catalog'
);

select results_eq(
  $$
    select
      (select count(*) from public.user_achievements
       where user_id = '10000000-0000-0000-0000-000000000005'),
      (select count(*) from public.point_events
       where user_id = '10000000-0000-0000-0000-000000000005'
         and action_type like 'achievement_unlocked:%')
  $$,
  $$values (13::bigint, 13::bigint)$$,
  '206. repeated checks keep one achievement and one point event per key'
);

select results_eq(
  $$
    select achievement_key, name
    from public.achievement_definitions
    where achievement_key in ('rule_paladin', 'rule_quard')
  $$,
  $$values ('rule_quard', 'Strażnik Zasad')$$,
  '207. rules badge uses the renamed key and display name'
);

select results_eq(
  $$
    select pronargs::integer, oidvectortypes(proargtypes)
    from pg_proc
    where oid = 'public.award_play_result_achievements(uuid)'::regprocedure
  $$,
  $$values (1::integer, 'uuid')$$,
  '208. play result achievement RPC accepts only a play id'
);

set local role anon;
select throws_ok(
  $$select * from public.award_play_result_achievements('78000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '209. anonymous user cannot execute play result achievement RPC'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.award_play_result_achievements('78000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '210. inactive member cannot award play result achievements'
);
reset role;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000008',
    'authenticated', 'authenticated', 'natural-one-isolated@twojatura.local',
    extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')),
    '2026-01-01 10:00:00+00', '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Natural One Isolated"}',
    '2026-01-01 10:00:00+00', '2026-01-01 10:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000009',
    'authenticated', 'authenticated', 'tied-last-a@twojatura.local',
    extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')),
    '2026-01-01 10:00:00+00', '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Tied Last A"}',
    '2026-01-01 10:00:00+00', '2026-01-01 10:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000010',
    'authenticated', 'authenticated', 'tied-last-b@twojatura.local',
    extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')),
    '2026-01-01 10:00:00+00', '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Tied Last B"}',
    '2026-01-01 10:00:00+00', '2026-01-01 10:00:00+00'
  );

-- auth.users insert above already self-provisioned these via
-- private.provision_invited_member(); on conflict do nothing keeps this
-- block valid without relying on trigger side effects (values are the same).
insert into public.profiles (id, display_name, email)
values
  ('10000000-0000-0000-0000-000000000008', 'Natural One Isolated', 'natural-one-isolated@twojatura.local'),
  ('10000000-0000-0000-0000-000000000009', 'Tied Last A', 'tied-last-a@twojatura.local'),
  ('10000000-0000-0000-0000-000000000010', 'Tied Last B', 'tied-last-b@twojatura.local')
on conflict (id) do nothing;

insert into public.app_members (user_id, role, is_active)
values
  ('10000000-0000-0000-0000-000000000008', 'member', true),
  ('10000000-0000-0000-0000-000000000009', 'member', true),
  ('10000000-0000-0000-0000-000000000010', 'member', true)
on conflict (user_id) do nothing;

insert into public.plays (
  id,
  game_id,
  created_by,
  played_at,
  duration_minutes
)
values
  ('7c000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', '2026-10-01 17:59:00+00', 90),
  ('78000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', '2026-10-01 18:00:00+00', 90),
  ('7c000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', '2026-10-02 17:59:00+00', 90),
  ('78000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', '2026-10-02 18:00:00+00', 90),
  ('7c000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', '2026-10-03 17:59:00+00', 90),
  ('78000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', '2026-10-03 18:00:00+00', 90),
  ('7c000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', '2026-10-04 17:59:00+00', 90),
  ('78000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', '2026-10-04 18:00:00+00', 90),
  ('7c000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', '2026-10-05 17:59:00+00', 90),
  ('78000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-10-05 18:00:00+00', 90);

insert into public.play_participants (play_id, user_id, placement, is_winner)
values
  ('7c000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 2, false),
  ('78000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, true),
  ('78000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 2, false),
  ('78000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000008', 3, false),
  ('7c000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 2, false),
  ('7c000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000005', 2, false),
  ('7c000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 2, false),
  ('78000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 1, true),
  ('78000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', null, false),
  ('7c000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 2, false),
  ('78000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 1, true),
  ('78000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000009', 2, false),
  ('78000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000010', 2, false);

create temporary table pgtap_natural_one_balance_before as
select coalesce(sum(points), 0)::bigint as total_points
from public.point_events
where user_id = '10000000-0000-0000-0000-000000000008';

grant select on table pgtap_natural_one_balance_before to authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$
    select awarded_count, points_awarded, awarded_user_ids
    from public.award_play_result_achievements('78000000-0000-0000-0000-000000000001')
  $$,
  $$values (0::integer, 0::integer, array[]::uuid[])$$,
  '211. one last-place result does not award natural_one'
);

select results_eq(
  $$
    select
      (select count(*)::bigint from public.user_achievements where user_id = '10000000-0000-0000-0000-000000000008' and achievement_key = 'natural_one'),
      (select count(*)::bigint from public.point_events where user_id = '10000000-0000-0000-0000-000000000008' and action_type = 'achievement_unlocked:natural_one')
  $$,
  $$values (0::bigint, 0::bigint)$$,
  '212. one last-place result creates neither achievement nor point event'
);

insert into public.play_participants (play_id, user_id, placement, is_winner)
values
  ('78000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 1, true),
  ('78000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000008', 2, false);

select results_eq(
  $$
    select
      awarded_count,
      points_awarded
    from public.award_play_result_achievements('78000000-0000-0000-0000-000000000002')
  $$,
  $$values (0::integer, 0::integer)$$,
  '213. two last-place results do not award natural_one'
);

insert into public.play_participants (play_id, user_id, placement, is_winner)
values
  ('78000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 1, true),
  ('78000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000008', 2, false);

select results_eq(
  $$
    select awarded_count, points_awarded, awarded_user_ids
    from public.award_play_result_achievements('78000000-0000-0000-0000-000000000003')
  $$,
  $$values (1::integer, 5::integer, array['10000000-0000-0000-0000-000000000008'::uuid])$$,
  '214. three last-place results award natural_one'
);

-- The RPC above awards another active member. Inspect the recipient's private
-- point ledger as the test owner; the caller correctly cannot read it through RLS.
reset role;

select results_eq(
  $$
    select
      (select count(*)::bigint from public.user_achievements where user_id = '10000000-0000-0000-0000-000000000008' and achievement_key = 'natural_one'),
      (select count(*)::bigint from public.point_events where user_id = '10000000-0000-0000-0000-000000000008' and action_type = 'achievement_unlocked:natural_one')
  $$,
  $$values (1::bigint, 1::bigint)$$,
  '215. three last-place results create one achievement and one point event'
);

select results_eq(
  $$
    select
      award.awarded_count,
      award.points_awarded,
      (select count(*)::bigint from public.point_events where user_id = '10000000-0000-0000-0000-000000000008' and action_type = 'achievement_unlocked:natural_one')
    from public.award_play_result_achievements('78000000-0000-0000-0000-000000000003') as award
  $$,
  $$values (0::integer, 0::integer, 1::bigint)$$,
  '216. repeated result evaluation does not duplicate natural_one or its point event'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000008","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$select total_points from public.user_point_balances where user_id = '10000000-0000-0000-0000-000000000008'$$,
  $$select total_points + 5 from pgtap_natural_one_balance_before$$,
  '217. natural_one increases the last-place participant balance exactly once'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.award_play_result_achievements('78000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '218. member without play management permission cannot award result achievements'
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
    select awarded_count, points_awarded, cardinality(awarded_user_ids)
    from public.award_play_result_achievements('78000000-0000-0000-0000-000000000005')
  $$,
  $$values (0::integer, 0::integer, 0::integer)$$,
  '219. one tied last-place result does not award natural_one yet'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.user_achievements
    where achievement_key = 'natural_one'
      and user_id in ('10000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000010')
  $$,
  $$values (0::bigint)$$,
  '220. tied last-place participants stay unawarded before the third result'
);

select results_eq(
  $$
    select awarded_count, points_awarded
    from public.award_play_result_achievements('78000000-0000-0000-0000-000000000004')
  $$,
  $$values (0::integer, 0::integer)$$,
  '221. incomplete placements do not count toward natural_one'
);
reset role;

insert into public.plays (
  id,
  game_id,
  created_by,
  played_at,
  duration_minutes
)
values
  ('79000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-01 18:00:00+00', 90),
  ('79000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-02 18:00:00+00', 90),
  ('79000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-03 18:00:00+00', 90),
  ('79000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-04 18:00:00+00', 90),
  ('79000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-05 18:00:00+00', 90),
  ('79000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-06 18:00:00+00', 90),
  ('79000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-07 18:00:00+00', 90),
  ('79000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-08 18:00:00+00', 90),
  ('79000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-09 18:00:00+00', 90),
  ('79000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-10 18:00:00+00', 90),
  ('79000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-11 18:00:00+00', 90),
  ('79000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-12 18:00:00+00', 90),
  ('79000000-0000-0000-0000-000000000013', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-13 18:00:00+00', 90),
  ('79000000-0000-0000-0000-000000000014', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-14 18:00:00+00', 90),
  ('79000000-0000-0000-0000-000000000015', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-15 18:00:00+00', 90),
  ('79000000-0000-0000-0000-000000000016', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-16 18:00:00+00', 90);

insert into public.play_participants (play_id, user_id, placement, is_winner)
values
  ('79000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 2, false),
  ('79000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 1, true),
  ('79000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 1, true),
  ('79000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 1, true),
  ('79000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 1, true),
  ('79000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 2, false),
  ('79000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000003', 1, true),
  ('79000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003', 1, true),
  ('79000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000004', 1, true),
  ('79000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000004', 1, true),
  ('79000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 2, false),
  ('79000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 1, true),
  ('79000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000005', 1, true),
  ('79000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', 1, true),
  ('79000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000004', 1, true),
  ('79000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000001', 1, true);

create temporary table pgtap_dark_urge_balance_before as
select coalesce(sum(points), 0)::bigint as total_points
from public.point_events
where user_id = '10000000-0000-0000-0000-000000000002';

grant select on table pgtap_dark_urge_balance_before to authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

-- Kontrakt zmieniony: dark_urge jest przyznawany przez przeliczanie wewnątrz
-- mutacji partii, a nie przez to osobne wywołanie. Zanim test tu dotrze,
-- użytkownik ma już odznakę, więc jawne wywołanie jest bezpiecznym no-opem.
-- Istotą testu pozostaje „trzy zwycięstwa z rzędu dają dark_urge” — sprawdzamy
-- to teraz wprost na stanie, zamiast na wartości zwracanej przez wywołanie,
-- które przestało być momentem przyznania.
select ok(
  exists (
    select 1
    from public.user_achievements
    where user_id = '10000000-0000-0000-0000-000000000002'
      and achievement_key = 'dark_urge'
  ),
  '222. three consecutive own wins award dark_urge'
);

select results_eq(
  $$
    select awarded_count, points_awarded, awarded_user_ids
    from public.award_play_result_achievements('79000000-0000-0000-0000-000000000004')
  $$,
  $$values (0::integer, 0::integer, array[]::uuid[])$$,
  '222a. explicit result-achievement call is a no-op once recompute granted it'
);

select results_eq(
  $$
    select awarded_count, points_awarded
    from public.award_play_result_achievements('79000000-0000-0000-0000-000000000008')
  $$,
  $$values (0::integer, 0::integer)$$,
  '223. a loss between wins prevents dark_urge'
);

-- Kontrakt zmieniony wraz z nową definicją dark_urge. Poprzednia reguła
-- wymagała, by seria KOŃCZYŁA SIĘ na partii przekazanej do wywołania — przez
-- co uczestnik, którego serię domknęła partia zapisana przez kogoś innego,
-- nie dostawał odznaki nigdy. Nowa reguła pyta o historię użytkownika:
-- gracz 0004 ma trzy kolejne zwycięstwa (partie 0009, 0010 i 0015), więc
-- odznaka mu się należy niezależnie od tego, kto zapisał którą partię
-- (wyrównanie zatwierdzone 2026-07-29).
--
-- Niezmiennik „dwa zwycięstwa to za mało” pozostaje pokryty testem 223,
-- gdzie porażka rozdziela zwycięstwa i żadne okno trzech nie powstaje.
select results_eq(
  $$
    select awarded_count, points_awarded, awarded_user_ids
    from public.award_play_result_achievements('79000000-0000-0000-0000-000000000010')
  $$,
  $$values (1::integer, 15::integer, array['10000000-0000-0000-0000-000000000004'::uuid])$$,
  '224. whole-history streak awards dark_urge to the qualifying participant'
);

select results_eq(
  $$
    select awarded_count, points_awarded, awarded_user_ids
    from public.award_play_result_achievements('79000000-0000-0000-0000-000000000016')
  $$,
  $$values (0::integer, 0::integer, array[]::uuid[])$$,
  '225. otherwise-qualifying dark_urge streak is a no-op for an admin recipient (role system)'
);

select results_eq(
  $$
    select
      award.awarded_count,
      award.points_awarded,
      (select count(*)::bigint from public.point_events where user_id = '10000000-0000-0000-0000-000000000002' and action_type = 'achievement_unlocked:dark_urge')
    from public.award_play_result_achievements('79000000-0000-0000-0000-000000000004') as award
  $$,
  $$values (0::integer, 0::integer, 1::bigint)$$,
  '226. repeated dark_urge evaluation does not duplicate the achievement or point event'
);

select results_eq(
  $$select total_points from public.user_point_balances where user_id = '10000000-0000-0000-0000-000000000002'$$,
  -- + 0, bo dark_urge (15 pkt) trafił do salda już WCZEŚNIEJ — przy mutacji
  -- partii, która domknęła serię — a więc jest zawarty w migawce
  -- pgtap_dark_urge_balance_before. Test nadal pilnuje tego, o co chodziło:
  -- odznaka podnosi saldo dokładnie raz i powtórne wywołania nic nie dodają.
  $$select total_points + 0 from pgtap_dark_urge_balance_before$$,
  '227. dark_urge increases the qualifying participant balance exactly once'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.award_play_result_achievements('79000000-0000-0000-0000-000000000004')$$,
  '42501',
  null,
  '228. member without play management permission cannot evaluate dark_urge'
);
reset role;

select results_eq(
  $$
    select count(*)::bigint
    from public.user_achievements
    where achievement_key = 'dark_urge'
      and user_id in ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001')
  $$,
  $$values (1::bigint)$$,
  '229. only the qualifying non-admin user receives dark_urge without backfill (admin is a gamification no-op)'
);

select set_config(
  'request.jwt.claims',
  '{"role":"anon"}',
  true
);
set local role anon;
select throws_ok(
  $$select * from public.award_meeting_achievements('7a000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '230. anon cannot execute camp_host evaluation'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.award_meeting_achievements('7a000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '231. inactive member cannot evaluate camp_host'
);
reset role;

insert into public.meetings (
  id,
  created_by,
  title,
  status,
  starts_at,
  ends_at
)
select
  ('7a000000-0000-0000-0000-' || lpad(series.value::text, 12, '0'))::uuid,
  '10000000-0000-0000-0000-000000000004',
  'Camp host meeting ' || series.value,
  'confirmed',
  '2026-12-01 16:00:00+00'::timestamptz + series.value * interval '1 day',
  '2026-12-01 20:00:00+00'::timestamptz + series.value * interval '1 day'
from generate_series(1, 5) as series(value);

insert into public.plays (
  id,
  game_id,
  created_by,
  played_at,
  duration_minutes
)
values (
  '7b000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '2026-12-01 18:00:00+00',
  90
);

create temporary table pgtap_camp_host_balance_before as
select coalesce(sum(points), 0)::bigint as total_points
from public.point_events
where user_id = '10000000-0000-0000-0000-000000000004';

grant select on table pgtap_camp_host_balance_before to authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$
    select awarded_count, points_awarded, awarded_keys
    from public.award_meeting_achievements('7b000000-0000-0000-0000-000000000001')
  $$,
  $$values (0::integer, 0::integer, array[]::text[])$$,
  '232. five elapsed meetings without Chronicle plays do not award camp_host'
);
reset role;

insert into public.plays (
  id,
  game_id,
  meeting_id,
  created_by,
  played_at,
  duration_minutes
)
values
  ('7b000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '2026-12-02 18:00:00+00', 90),
  ('7b000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '2026-12-02 20:00:00+00', 90),
  ('7b000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '2026-12-03 18:00:00+00', 90),
  ('7b000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '2026-12-04 18:00:00+00', 90),
  ('7b000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', '2026-12-05 18:00:00+00', 90);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$
    select awarded_count, points_awarded, awarded_keys
    from public.award_meeting_achievements('7b000000-0000-0000-0000-000000000006')
  $$,
  $$values (0::integer, 0::integer, array[]::text[])$$,
  '233. four completed meetings do not award camp_host even with multiple plays in one meeting'
);
reset role;

insert into public.plays (
  id,
  game_id,
  meeting_id,
  created_by,
  played_at,
  duration_minutes
)
values (
  '7b000000-0000-0000-0000-000000000007',
  '30000000-0000-0000-0000-000000000001',
  '7a000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000003',
  '2026-12-06 18:00:00+00',
  90
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$
    select awarded_count, points_awarded, awarded_keys
    from public.award_meeting_achievements('7b000000-0000-0000-0000-000000000007')
  $$,
  $$values (1::integer, 10::integer, array['camp_host']::text[])$$,
  '234. five distinct hosted meetings with Chronicle plays award camp_host'
);
reset role;

select results_eq(
  $$
    select
      award.awarded_count,
      award.points_awarded,
      (select count(*)::bigint from public.user_achievements where user_id = '10000000-0000-0000-0000-000000000004' and achievement_key = 'camp_host'),
      (select count(*)::bigint from public.point_events where user_id = '10000000-0000-0000-0000-000000000004' and action_type = 'achievement_unlocked:camp_host')
    from public.award_meeting_achievements('7b000000-0000-0000-0000-000000000007') as award
  $$,
  $$values (0::integer, 0::integer, 1::bigint, 1::bigint)$$,
  '235. repeated camp_host evaluation does not duplicate the achievement or point event'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$select total_points from public.user_point_balances where user_id = '10000000-0000-0000-0000-000000000004'$$,
  $$select total_points + 10 from pgtap_camp_host_balance_before$$,
  '236. camp_host increases the organizer balance exactly once'
);
reset role;

select results_eq(
  $$
    select count(*)::bigint
    from public.user_achievements
    where achievement_key = 'camp_host'
      and user_id = '10000000-0000-0000-0000-000000000004'
  $$,
  $$values (1::bigint)$$,
  '237. only the meeting organizer receives camp_host without backfill'
);

select has_column(
  'public',
  'profiles',
  'active_class_key',
  '238. profiles stores the selected active class'
);

select col_is_fk(
  'public',
  'profiles',
  'active_class_key',
  '239. active class references a class definition'
);

select has_function(
  'public',
  'set_active_class',
  array['text'],
  '240. narrow active class RPC exists'
);

set local role anon;
select throws_ok(
  $$select public.set_active_class('wojownik_stolu')$$,
  '42501',
  null,
  '241. anonymous users cannot select an active class'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.set_active_class('wojownik_stolu')$$,
  '42501',
  null,
  '242. inactive members cannot select an active class'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.set_active_class('druid_polki')$$,
  '42501',
  null,
  '243. active member cannot select a locked class'
);
reset role;

insert into public.user_achievements (user_id, achievement_key, awarded_by)
select
  '10000000-0000-0000-0000-000000000002',
  requirement.achievement_key,
  '10000000-0000-0000-0000-000000000001'
from public.class_requirements as requirement
where requirement.class_key in ('wojownik_stolu', 'bard_stolu')
on conflict (user_id, achievement_key) do nothing;

set local role authenticated;
select results_eq(
  $$select public.set_active_class('wojownik_stolu')$$,
  $$values ('wojownik_stolu'::text)$$,
  '244. active member can select an unlocked class'
);

select results_eq(
  $$
    select active_class_key
    from public.profiles
    where id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$values ('wojownik_stolu'::text)$$,
  '245. selected class is stored only on the current profile'
);

do $$
begin
  perform public.set_active_class('bard_stolu');
end;
$$;

select results_eq(
  $$
    select active_class_key
    from public.profiles
    where id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$values ('bard_stolu'::text)$$,
  '246. user can switch between unlocked classes'
);

select throws_ok(
  $$
    update public.profiles
    set active_class_key = 'bard_stolu'
    where id = '10000000-0000-0000-0000-000000000003'
  $$,
  '42501',
  null,
  '247. member cannot set an active class on another profile'
);

do $$
begin
  perform public.set_active_class(null);
end;
$$;

select results_eq(
  $$
    select active_class_key is null
    from public.profiles
    where id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$values (true)$$,
  '248. user can clear their own active class selection'
);
reset role;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000007',
  'authenticated',
  'authenticated',
  'coop-achievement@twojatura.local',
  extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')),
  '2026-01-01 10:00:00+00',
  '', '', '', '',
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Kooperacyjny QA"}',
  '2026-01-01 10:00:00+00',
  '2026-01-01 10:00:00+00'
);

-- auth.users insert above already self-provisioned this via
-- private.provision_invited_member(); on conflict do nothing keeps this
-- block valid without relying on trigger side effects (values are the same).
insert into public.profiles (id, display_name, email)
values (
  '10000000-0000-0000-0000-000000000007',
  'Kooperacyjny QA',
  'coop-achievement@twojatura.local'
)
on conflict (id) do nothing;

insert into public.app_members (user_id, role, is_active)
values ('10000000-0000-0000-0000-000000000007', 'member', true)
on conflict (user_id) do nothing;

insert into public.plays (
  id,
  game_id,
  created_by,
  played_at,
  duration_minutes
)
values
  ('7d000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', '2027-01-01 18:00:00+00', 90),
  ('7d000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', '2027-01-02 18:00:00+00', 90),
  ('7d000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', '2027-01-03 18:00:00+00', 90);

insert into public.play_participants (play_id, user_id, placement, is_winner)
values
  ('7d000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', 1, true),
  ('7d000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 1, true),
  ('7d000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 1, true),
  ('7d000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', 1, true),
  ('7d000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 1, true),
  ('7d000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', 1, true),
  ('7d000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000007', 1, true),
  ('7d000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 1, true),
  ('7d000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000005', 1, true);

select results_eq(
  $$
    select private.count_real_last_places('10000000-0000-0000-0000-000000000007')
  $$,
  $$values (0::integer)$$,
  '249. cooperative 1/1/1 results do not count toward natural_one progress'
);

select results_eq(
  $$
    select private.is_real_last_place(
      '78000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000008'
    )
  $$,
  $$values (true)$$,
  '250. a 1/2/3 ranking counts the participant in third place as last'
);

select results_eq(
  $$
    select
      private.is_real_last_place(
        '78000000-0000-0000-0000-000000000005',
        '10000000-0000-0000-0000-000000000009'
      ),
      private.is_real_last_place(
        '78000000-0000-0000-0000-000000000005',
        '10000000-0000-0000-0000-000000000010'
      )
  $$,
  $$values (true, true)$$,
  '251. a 1/2/2 ranking counts both tied participants in second place as last'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.user_achievements
    where user_id = '10000000-0000-0000-0000-000000000008'
      and achievement_key = 'natural_one'
  $$,
  $$values (1::bigint)$$,
  '252. three real last-place results still award natural_one'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000007","role":"authenticated"}',
  true
);
set local role authenticated;
do $$
begin
  perform public.award_play_result_achievements('7d000000-0000-0000-0000-000000000001');
  perform public.award_play_result_achievements('7d000000-0000-0000-0000-000000000002');
  perform public.award_play_result_achievements('7d000000-0000-0000-0000-000000000003');
end;
$$;
reset role;

select results_eq(
  $$
    select
      count(*) filter (where achievement_key = 'dark_urge')::bigint,
      count(*) filter (where achievement_key = 'natural_one')::bigint
    from public.user_achievements
    where user_id = '10000000-0000-0000-0000-000000000007'
  $$,
  $$values (1::bigint, 0::bigint)$$,
  '253. three cooperative 1/1/1 wins award dark_urge without natural_one'
);

-- 254-264: in_progress -> completed play status lifecycle.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000011',
  'authenticated', 'authenticated', 'in-progress-tester@twojatura.local',
  extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')),
  '2026-01-01 10:00:00+00', '', '', '', '',
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"In Progress Tester"}',
  '2026-01-01 10:00:00+00', '2026-01-01 10:00:00+00'
);

-- auth.users insert above already self-provisioned this via
-- private.provision_invited_member(); on conflict do nothing keeps this
-- block valid without relying on trigger side effects (values are the same).
insert into public.profiles (id, display_name, email)
values (
  '10000000-0000-0000-0000-000000000011',
  'In Progress Tester',
  'in-progress-tester@twojatura.local'
)
on conflict (id) do nothing;

insert into public.app_members (user_id, role, is_active)
values ('10000000-0000-0000-0000-000000000011', 'member', true)
on conflict (user_id) do nothing;

-- 24 already-completed plays so a 25th, still in_progress, play must not
-- unlock coast_chronicler until it is actually completed.
insert into public.plays (id, game_id, created_by, played_at, status)
select
  md5('in-progress-history-' || series.value)::uuid,
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000011',
  '2026-09-01 12:00:00+00'::timestamptz + series.value * interval '1 day',
  'completed'
from generate_series(1, 24) as series(value);

insert into public.play_participants (play_id, user_id, placement, is_winner)
select
  md5('in-progress-history-' || series.value)::uuid,
  '10000000-0000-0000-0000-000000000011',
  1,
  true
from generate_series(1, 24) as series(value);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000011","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$
    select public.create_play_with_participants(
      p_game_id := '30000000-0000-0000-0000-000000000001',
      p_played_at := '2026-10-01 18:00:00+00'::timestamptz,
      p_participants := '[]'::jsonb,
      p_status := 'in_progress',
      p_state_note := 'Brak graczy'
    )
  $$,
  '23514',
  null,
  '254. in_progress play still requires at least one participant'
);

select throws_ok(
  $$
    select public.create_play_with_participants(
      p_game_id := '30000000-0000-0000-0000-000000000001',
      p_played_at := '2026-10-01 18:00:00+00'::timestamptz,
      p_participants := '[{"user_id":"10000000-0000-0000-0000-000000000011","is_winner":false}]'::jsonb,
      p_status := 'completed'
    )
  $$,
  '23514',
  null,
  '255. completed play still requires at least one winner'
);

insert into pgtap_created_plays (label, play_id)
select
  'in-progress-play',
  public.create_play_with_participants(
    p_game_id := '30000000-0000-0000-0000-000000000001',
    p_played_at := '2026-10-01 18:00:00+00'::timestamptz,
    p_participants := '[{"user_id":"10000000-0000-0000-0000-000000000011","is_winner":false}]'::jsonb,
    p_status := 'in_progress',
    p_state_note := 'Runda 3 z 5, wracamy jutro'
  );

select ok(
  (
    select play_id from pgtap_created_plays
    where label = 'in-progress-play'
  ) is not null,
  '256. in_progress play with a participant and no winner can be created'
);

select results_eq(
  $$
    select awarded, points
    from public.award_play_logged_points(
      (select play_id from pgtap_created_plays where label = 'in-progress-play')
    )
  $$,
  $$values (false, 0)$$,
  '257. play_logged points are withheld while a play is in_progress'
);

select public.award_current_user_simple_achievements();

select ok(
  not private.has_achievement('coast_chronicler'),
  '258. a 25th play still in_progress does not unlock coast_chronicler'
);

select lives_ok(
  $$
    select public.update_play_with_participants(
      p_play_id := (
        select play_id from pgtap_created_plays
        where label = 'in-progress-play'
      ),
      p_game_id := '30000000-0000-0000-0000-000000000001',
      p_played_at := '2026-10-01 18:00:00+00'::timestamptz,
      p_participants := '[{"user_id":"10000000-0000-0000-0000-000000000011","is_winner":true,"placement":1}]'::jsonb,
      p_status := 'completed'
    )
  $$,
  '259. resuming and completing the same play updates it in place'
);

select results_eq(
  $$
    select count(*)::bigint from public.plays
    where created_by = '10000000-0000-0000-0000-000000000011'
  $$,
  $$values (25::bigint)$$,
  '260. completing the play does not create a new row'
);

-- Kontrakt zmieniony: punkty za zapis przyznaje przeliczanie wewnątrz
-- update_play_with_participants (test 259), a nie to osobne wywołanie.
-- Sedno testu — „punkty pojawiają się dokładnie w chwili ukończenia partii,
-- dokładnie raz” — sprawdzamy teraz wprost na księdze, a jawne wywołanie
-- pozostaje jako dowód idempotencji (awarded = false).
select results_eq(
  $$
    select count(*)::bigint, coalesce(sum(points), 0)::bigint
    from public.point_events
    where action_type = 'play_logged'
      and related_entity_id = (
        select play_id from pgtap_created_plays where label = 'in-progress-play'
      )
  $$,
  $$values (1::bigint, 40::bigint)$$,
  '261. play_logged points are granted exactly when the play becomes completed'
);

select results_eq(
  $$
    select awarded, points
    from public.award_play_logged_points(
      (select play_id from pgtap_created_plays where label = 'in-progress-play')
    )
  $$,
  $$values (false, 40)$$,
  '261a. explicit play_logged award is a no-op once recompute granted it'
);

select results_eq(
  $$
    select awarded, points
    from public.award_play_logged_points(
      (select play_id from pgtap_created_plays where label = 'in-progress-play')
    )
  $$,
  $$values (false, 40)$$,
  '262. re-awarding play_logged points on an already-completed play is a no-op'
);

select public.award_current_user_simple_achievements();

select ok(
  private.has_achievement('coast_chronicler'),
  '263. completing the 25th play unlocks coast_chronicler'
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
    select public.update_play_with_participants(
      p_play_id := (
        select play_id from pgtap_created_plays
        where label = 'in-progress-play'
      ),
      p_game_id := '30000000-0000-0000-0000-000000000001',
      p_played_at := '2026-10-01 18:00:00+00'::timestamptz,
      p_participants := '[{"user_id":"10000000-0000-0000-0000-000000000011","is_winner":true,"placement":1}]'::jsonb,
      p_status := 'completed'
    )
  $$,
  '42501',
  null,
  '264. an unrelated member cannot update someone else''s play status'
);
reset role;

-- 265-283: play_photos (Etap C1-C3) — RLS, position auto-assignment,
-- 15-photo/15 MB limits, reorder_play_photos, and the play-photos bucket.
insert into public.plays (id, game_id, created_by, played_at, status)
values (
  '90000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '2026-11-01 18:00:00+00',
  'completed'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    insert into public.play_photos (
      play_id, storage_path, position, byte_size, width, height, created_by
    ) values (
      '90000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000001/photo-1.webp',
      1, 100000, 800, 600,
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  '265. play creator can insert a photo'
);

select results_eq(
  $$
    select position from public.play_photos
    where storage_path = '90000000-0000-0000-0000-000000000001/photo-1.webp'
  $$,
  $$values (1::smallint)$$,
  '266. first inserted photo is auto-assigned position 1'
);

select lives_ok(
  $$
    insert into public.play_photos (
      play_id, storage_path, position, byte_size, width, height, created_by
    ) values (
      '90000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000001/photo-2.webp',
      1, 100000, 800, 600,
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  '267. second photo insert ignores the client-sent position'
);

select results_eq(
  $$
    select position from public.play_photos
    where storage_path = '90000000-0000-0000-0000-000000000001/photo-2.webp'
  $$,
  $$values (2::smallint)$$,
  '268. second inserted photo is auto-assigned position 2'
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
    insert into public.play_photos (
      play_id, storage_path, position, byte_size, width, height, created_by
    ) values (
      '90000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000001/photo-intruder.webp',
      1, 100000, 800, 600,
      '10000000-0000-0000-0000-000000000003'
    )
  $$,
  '42501',
  null,
  '269. an unrelated member cannot insert a photo for someone else''s play'
);

select cmp_ok(
  (
    select count(*)::bigint from public.play_photos
    where play_id = '90000000-0000-0000-0000-000000000001'
  ),
  '=',
  2::bigint,
  '270. an unrelated member can still read the play''s photos (select is open to members)'
);

delete from public.play_photos
where storage_path = '90000000-0000-0000-0000-000000000001/photo-1.webp';

select cmp_ok(
  (
    select count(*)::bigint from public.play_photos
    where storage_path = '90000000-0000-0000-0000-000000000001/photo-1.webp'
  ),
  '=',
  1::bigint,
  '271. an unrelated member''s delete attempt removes nothing (RLS silently filters it)'
);
reset role;

insert into public.plays (id, game_id, created_by, played_at, status)
values (
  '90000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '2026-11-02 18:00:00+00',
  'completed'
);

insert into public.play_photos (
  play_id, storage_path, position, byte_size, width, height, created_by
)
select
  '90000000-0000-0000-0000-000000000002',
  '90000000-0000-0000-0000-000000000002/limit-' || series.value || '.webp',
  1, 100000, 800, 600,
  '10000000-0000-0000-0000-000000000002'
from generate_series(1, 15) as series(value);

select cmp_ok(
  (
    select count(*)::bigint from public.play_photos
    where play_id = '90000000-0000-0000-0000-000000000002'
  ),
  '=',
  15::bigint,
  '272. fifteen photos can be added to a single play'
);

select throws_ok(
  $$
    insert into public.play_photos (
      play_id, storage_path, position, byte_size, width, height, created_by
    ) values (
      '90000000-0000-0000-0000-000000000002',
      '90000000-0000-0000-0000-000000000002/limit-16.webp',
      1, 100000, 800, 600,
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  '23514',
  null,
  '273. a sixteenth photo is rejected'
);

insert into public.plays (id, game_id, created_by, played_at, status)
values (
  '90000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '2026-11-03 18:00:00+00',
  'completed'
);

insert into public.play_photos (
  play_id, storage_path, position, byte_size, width, height, created_by
) values (
  '90000000-0000-0000-0000-000000000003',
  '90000000-0000-0000-0000-000000000003/big-1.webp',
  1, 15 * 1024 * 1024 - 1000, 800, 600,
  '10000000-0000-0000-0000-000000000002'
);

select throws_ok(
  $$
    insert into public.play_photos (
      play_id, storage_path, position, byte_size, width, height, created_by
    ) values (
      '90000000-0000-0000-0000-000000000003',
      '90000000-0000-0000-0000-000000000003/big-2.webp',
      1, 2000, 800, 600,
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  '23514',
  null,
  '274. a photo pushing the play past 15 MB total is rejected'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    select public.reorder_play_photos(
      '90000000-0000-0000-0000-000000000001',
      (
        select array_agg(id order by position desc)
        from public.play_photos
        where play_id = '90000000-0000-0000-0000-000000000001'
      )
    )
  $$,
  '275. play owner can reorder photos'
);

select results_eq(
  $$
    select storage_path from public.play_photos
    where play_id = '90000000-0000-0000-0000-000000000001'
    order by position
  $$,
  $$values
    ('90000000-0000-0000-0000-000000000001/photo-2.webp'),
    ('90000000-0000-0000-0000-000000000001/photo-1.webp')
  $$,
  '276. reorder actually swaps stored positions'
);

select throws_ok(
  $$
    select public.reorder_play_photos(
      '90000000-0000-0000-0000-000000000001',
      array['00000000-0000-0000-0000-000000000000'::uuid]
    )
  $$,
  '22023',
  null,
  '277. reorder rejects a photo id list that does not match existing photos'
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
    select public.reorder_play_photos(
      '90000000-0000-0000-0000-000000000001',
      (
        select array_agg(id) from public.play_photos
        where play_id = '90000000-0000-0000-0000-000000000001'
      )
    )
  $$,
  '42501',
  null,
  '278. an unrelated member cannot reorder someone else''s play photos'
);
reset role;

select results_eq(
  $$
    select public, file_size_limit, allowed_mime_types
    from storage.buckets
    where id = 'play-photos'
  $$,
  $$values (false, 2097152::bigint, array['image/webp','image/jpeg']::text[])$$,
  '279. play-photos bucket is private with the expected size/type limits'
);

insert into storage.objects (bucket_id, name)
values ('play-photos', '90000000-0000-0000-0000-000000000001/existing.webp');

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select cmp_ok(
  (select count(*)::bigint from storage.objects where bucket_id = 'play-photos'),
  '>=',
  1::bigint,
  '280. an active member can list objects in the play-photos bucket'
);

select lives_ok(
  $$
    insert into storage.objects (bucket_id, name)
    values ('play-photos', '90000000-0000-0000-0000-000000000001/owner-upload.webp')
  $$,
  '281. the play owner can insert an object under their play''s folder'
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
    insert into storage.objects (bucket_id, name)
    values ('play-photos', '90000000-0000-0000-0000-000000000001/intruder-upload.webp')
  $$,
  '42501',
  null,
  '282. an unrelated member cannot insert an object under someone else''s play folder'
);

-- Supabase's own storage.protect_delete() trigger blocks ANY direct SQL
-- DELETE on storage.objects (for every role, not just this one) — real
-- deletes must go through the Storage API, which is what
-- play_photos_storage_delete_owner_or_admin actually gates. A raw DELETE
-- can't reach that policy at all, so this only re-confirms the built-in
-- guard is in place rather than testing our own authorization.
select throws_ok(
  $$
    delete from storage.objects
    where bucket_id = 'play-photos'
      and name = '90000000-0000-0000-0000-000000000001/existing.webp'
  $$,
  '42501',
  null,
  '283. direct SQL deletes on storage.objects are always blocked; deletion goes through the Storage API'
);
reset role;

-- Safe meeting deletion: soft delete, Chronicle protection and point reversals.
insert into public.meetings (
  id, created_by, title, status, starts_at, ends_at
) values
  (
    '8d000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'Spotkanie do bezpiecznego usunięcia',
    'planned',
    '2027-02-01 18:00:00+00',
    '2027-02-01 22:00:00+00'
  ),
  (
    '8d000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    'Spotkanie usuwane przez admina',
    'planned',
    '2027-02-02 18:00:00+00',
    '2027-02-02 22:00:00+00'
  ),
  (
    '8d000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    'Spotkanie z wpisem Kroniki',
    'completed',
    '2027-02-03 18:00:00+00',
    '2027-02-03 22:00:00+00'
  );

insert into public.meeting_availability (meeting_id, user_id, is_available)
values
  (
    '8d000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    true
  ),
  (
    '8d000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    true
  );

insert into public.meeting_game_votes (meeting_id, game_id, user_id)
values
  (
    '8d000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002'
  ),
  (
    '8d000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003'
  );

insert into public.plays (
  id, game_id, meeting_id, created_by, played_at, status
) values (
  '8e000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '8d000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002',
  '2027-02-03 18:30:00+00',
  'completed'
);

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
    25,
    'meeting_created',
    'Test utworzenia spotkania',
    'meeting',
    '8d000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    10,
    'meeting_rsvp',
    'Test RSVP',
    'meeting',
    '8d000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    10,
    'meeting_vote',
    'Test głosu',
    'meeting',
    '8d000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    10,
    'meeting_rsvp',
    'Test RSVP drugiego gracza',
    'meeting',
    '8d000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    10,
    'meeting_vote',
    'Test głosu drugiego gracza',
    'meeting',
    '8d000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    30,
    'rating_created',
    'Niezwiązany typ punktów',
    'meeting',
    '8d000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002'
  );

create temporary table pgtap_meeting_delete_balances (
  user_id uuid primary key,
  total_points bigint not null
);

insert into pgtap_meeting_delete_balances (user_id, total_points)
select user_id, sum(points)::bigint
from public.point_events
where user_id in (
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
)
group by user_id;

grant select on pgtap_meeting_delete_balances to authenticated;

select ok(
  not has_table_privilege('authenticated', 'public.meetings', 'DELETE'),
  '284. authenticated clients have no hard-delete privilege on meetings'
);

set local role anon;
select throws_ok(
  $$select public.delete_meeting('8d000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '285. anon cannot execute delete_meeting'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.delete_meeting('8d000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '286. inactive member cannot execute delete_meeting'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.delete_meeting('8d000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  '287. member cannot delete another creator meeting'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.delete_meeting('8d000000-0000-0000-0000-000000000003')$$,
  'P0001',
  'Nie można usunąć spotkania z zapisaną partią w Kronice.',
  '288. meeting linked to a Chronicle play cannot be deleted'
);
reset role;

select is(
  (
    select deleted_at
    from public.meetings
    where id = '8d000000-0000-0000-0000-000000000003'
  ),
  null::timestamptz,
  '289. blocked Chronicle meeting remains active'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select public.delete_meeting('8d000000-0000-0000-0000-000000000001')$$,
  $$values (true)$$,
  '290. creator can soft-delete their own meeting'
);
reset role;

select results_eq(
  $$
    select deleted_at is not null, deleted_by
    from public.meetings
    where id = '8d000000-0000-0000-0000-000000000001'
  $$,
  $$
    values (
      true,
      '10000000-0000-0000-0000-000000000002'::uuid
    )
  $$,
  '291. soft delete stores deleted_at and deleted_by'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.meetings
    where id = '8d000000-0000-0000-0000-000000000001'
  $$,
  $$values (1::bigint)$$,
  '292. soft-deleted meeting is not physically deleted'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.meeting_availability
    where meeting_id = '8d000000-0000-0000-0000-000000000001'
  $$,
  $$values (2::bigint)$$,
  '293. soft delete physically retains RSVP rows'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.meeting_game_votes
    where meeting_id = '8d000000-0000-0000-0000-000000000001'
  $$,
  $$values (2::bigint)$$,
  '294. soft delete physically retains vote rows'
);

select results_eq(
  $$
    select
      action_type,
      count(*)::bigint,
      sum(points)::bigint
    from public.point_events
    where related_entity_type = 'meeting'
      and related_entity_id = '8d000000-0000-0000-0000-000000000001'
      and action_type like 'reversal:%'
    group by action_type
    order by action_type
  $$,
  $$
    values
      ('reversal:meeting_created', 1::bigint, -25::bigint),
      ('reversal:meeting_rsvp', 2::bigint, -20::bigint),
      ('reversal:meeting_vote', 2::bigint, -20::bigint)
  $$,
  '295. deletion reverses only created RSVP and vote meeting points'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$
    select
      before.user_id,
      before.total_points - current_balance.total_points as balance_drop
    from pgtap_meeting_delete_balances as before
    join public.user_point_balances as current_balance
      on current_balance.user_id = before.user_id
    order by before.user_id
  $$,
  $$
    values
      ('10000000-0000-0000-0000-000000000002'::uuid, 45::bigint),
      ('10000000-0000-0000-0000-000000000003'::uuid, 20::bigint)
  $$,
  '296. user_point_balances drops by each recipient reversed points'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select public.delete_meeting('8d000000-0000-0000-0000-000000000001')$$,
  $$values (false)$$,
  '297. repeated delete_meeting call is an idempotent no-op'
);
reset role;

select results_eq(
  $$
    select count(*)::bigint
    from public.point_events
    where related_entity_id = '8d000000-0000-0000-0000-000000000001'
      and action_type like 'reversal:%'
  $$,
  $$values (5::bigint)$$,
  '298. repeated deletion does not duplicate reversal events'
);

select results_eq(
  $$
    select points, action_type
    from public.point_events
    where related_entity_id = '8d000000-0000-0000-0000-000000000002'
      and action_type = 'rating_created'
  $$,
  $$values (30, 'rating_created')$$,
  '299. unrelated point events are not reversed'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select public.delete_meeting('8d000000-0000-0000-0000-000000000002')$$,
  $$values (true)$$,
  '300. admin can soft-delete another creator meeting'
);
reset role;

select results_eq(
  $$
    select deleted_at is not null, deleted_by
    from public.meetings
    where id = '8d000000-0000-0000-0000-000000000002'
  $$,
  $$
    values (
      true,
      '10000000-0000-0000-0000-000000000001'::uuid
    )
  $$,
  '301. admin deletion records the admin as deleted_by'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$
    select count(*)::bigint
    from public.meetings
    where id = '8d000000-0000-0000-0000-000000000001'
  $$,
  $$values (0::bigint)$$,
  '302. soft-deleted meeting is hidden by RLS'
);

select throws_ok(
  $$
    select *
    from public.award_meeting_created_points(
      '8d000000-0000-0000-0000-000000000001'
    )
  $$,
  '22023',
  null,
  '303. deleted meeting cannot receive fresh automatic points'
);

select throws_ok(
  $$
    insert into public.meeting_game_votes (meeting_id, game_id, user_id)
    values (
      '8d000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  null,
  '304. deleted meeting cannot accept new votes'
);
reset role;

select * from finish();
rollback;
