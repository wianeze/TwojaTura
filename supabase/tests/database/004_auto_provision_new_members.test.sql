begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

-- Covers 20260726120000_auto_provision_new_members.sql: every new
-- auth.users row now self-provisions (no raw_user_meta_data.twoja_tura_invite
-- required), and private.backfill_unprovisioned_members() safely catches up
-- any pre-migration orphaned row without ever touching an existing
-- profiles/app_members row (role, is_active, or otherwise).

-- 1. Create new user with zero metadata (the Dashboard "Create new user"
-- case with no User Metadata typed in at all) — profile + active member,
-- display_name falls back to the email local-part.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '92000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'no-metadata@twojatura.local',
  extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now()
);

select results_eq(
  $$select display_name, email from public.profiles where id = '92000000-0000-0000-0000-000000000001'$$,
  $$values ('no-metadata', 'no-metadata@twojatura.local')$$,
  '1. Create new user with no metadata provisions a profile with the email local-part as display_name'
);

select results_eq(
  $$select role, is_active from public.app_members where user_id = '92000000-0000-0000-0000-000000000001'$$,
  $$values ('member'::public.membership_role, true)$$,
  '2. Create new user with no metadata is provisioned as an active member'
);

-- 2. Invite-style metadata (twoja_tura_invite still set, for backward
-- compatibility with scripts/invite-user.mjs) — behaves identically, the
-- flag is simply ignored now.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '92000000-0000-0000-0000-000000000002',
  'authenticated', 'authenticated', 'invited-with-flag@twojatura.local',
  extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"twoja_tura_invite":true,"display_name":"Zaproszona Osoba"}',
  now(), now()
);

select results_eq(
  $$select display_name, email from public.profiles where id = '92000000-0000-0000-0000-000000000002'$$,
  $$values ('Zaproszona Osoba', 'invited-with-flag@twojatura.local')$$,
  '3. Invite metadata (twoja_tura_invite=true) still provisions a profile the same way'
);

select results_eq(
  $$select role, is_active from public.app_members where user_id = '92000000-0000-0000-0000-000000000002'$$,
  $$values ('member'::public.membership_role, true)$$,
  '4. Invite metadata still provisions an active member'
);

-- 3-5. Re-running the backfill must never touch any existing app_members
-- row, whatever its role/is_active currently is. Kuba is promoted to
-- observer here (same pattern as 003_admin_provisioning_backfill.test.sql)
-- so both non-default roles are covered alongside the seeded admin and the
-- seeded inactive member.
update public.app_members set role = 'observer' where user_id = '10000000-0000-0000-0000-000000000005';

select private.backfill_unprovisioned_members();

select results_eq(
  $$select role, is_active from public.app_members where user_id = '10000000-0000-0000-0000-000000000001'$$,
  $$values ('admin'::public.membership_role, true)$$,
  '5. backfill leaves the existing admin unchanged'
);

select results_eq(
  $$select role, is_active from public.app_members where user_id = '10000000-0000-0000-0000-000000000005'$$,
  $$values ('observer'::public.membership_role, true)$$,
  '6. backfill leaves the existing observer unchanged'
);

select results_eq(
  $$select role, is_active from public.app_members where user_id = '10000000-0000-0000-0000-000000000006'$$,
  $$values ('member'::public.membership_role, false)$$,
  '7. backfill does not reactivate an already-inactive member'
);

-- 6. A truly orphaned auth.users row (simulating one that predates this
-- migration). auth.users is owned by supabase_auth_admin, not the role this
-- test connects as, so the trigger itself can't be disabled for the insert
-- (ALTER TABLE would fail with "must be owner of table users"). Instead:
-- let the trigger self-provision as usual, then delete the two rows it just
-- created — that reproduces the exact "auth.users row with no
-- profiles/app_members row" state a pre-migration legacy account would be
-- in, without touching the trigger.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '92000000-0000-0000-0000-000000000003',
  'authenticated', 'authenticated', 'orphaned-legacy@twojatura.local',
  extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Sierota Sprzed Migracji"}',
  now(), now()
);

delete from public.app_members where user_id = '92000000-0000-0000-0000-000000000003';
delete from public.profiles where id = '92000000-0000-0000-0000-000000000003';

select ok(
  not exists (select 1 from public.profiles where id = '92000000-0000-0000-0000-000000000003'),
  '8. the simulated legacy orphaned row has no profile (trigger-created rows removed to reproduce a pre-migration orphan)'
);

select private.backfill_unprovisioned_members();

select results_eq(
  $$select display_name, email from public.profiles where id = '92000000-0000-0000-0000-000000000003'$$,
  $$values ('Sierota Sprzed Migracji', 'orphaned-legacy@twojatura.local')$$,
  '9. backfill provisions the orphaned legacy row'
);

select results_eq(
  $$select role, is_active from public.app_members where user_id = '92000000-0000-0000-0000-000000000003'$$,
  $$values ('member'::public.membership_role, true)$$,
  '10. the backfilled legacy row becomes an active member'
);

-- 7. Idempotency: run the backfill twice more and confirm nothing moves —
-- no duplicate rows, and every account touched above stays exactly as it
-- was after the first backfill call.
select private.backfill_unprovisioned_members();
select private.backfill_unprovisioned_members();

select results_eq(
  $$select count(*)::bigint from public.profiles where id = '92000000-0000-0000-0000-000000000003'$$,
  $$values (1::bigint)$$,
  '11. repeated backfill calls do not duplicate the profile row'
);

select results_eq(
  $$select count(*)::bigint from public.app_members where user_id = '92000000-0000-0000-0000-000000000003'$$,
  $$values (1::bigint)$$,
  '12. repeated backfill calls do not duplicate the membership row'
);

select results_eq(
  $$select role, is_active from public.app_members where user_id = '10000000-0000-0000-0000-000000000001'$$,
  $$values ('admin'::public.membership_role, true)$$,
  '13. idempotent re-run still leaves the existing admin unchanged'
);

select results_eq(
  $$select role, is_active from public.app_members where user_id = '10000000-0000-0000-0000-000000000005'$$,
  $$values ('observer'::public.membership_role, true)$$,
  '14. idempotent re-run still leaves the existing observer unchanged'
);

select results_eq(
  $$select role, is_active from public.app_members where user_id = '10000000-0000-0000-0000-000000000006'$$,
  $$values ('member'::public.membership_role, false)$$,
  '15. idempotent re-run still does not reactivate the inactive member'
);

select results_eq(
  $$select count(*)::bigint from public.app_members where user_id = '92000000-0000-0000-0000-000000000001'$$,
  $$values (1::bigint)$$,
  '16. idempotent re-run does not duplicate the no-metadata user membership'
);

select results_eq(
  $$select count(*)::bigint from public.app_members where user_id = '92000000-0000-0000-0000-000000000002'$$,
  $$values (1::bigint)$$,
  '17. idempotent re-run does not duplicate the invite-flag user membership'
);

-- A missing/blank email must still be rejected outright (requirement:
-- "nadal wymagać poprawnego emaila"), same as before this migration.
select throws_ok(
  $$
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      '92000000-0000-0000-0000-000000000099',
      'authenticated', 'authenticated', null,
      extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(), now()
    )
  $$,
  'P0001',
  null,
  '18. a new auth.users row with no email is still rejected by the trigger'
);

select results_eq(
  $$select count(*)::bigint from public.profiles where email is null$$,
  $$values (0::bigint)$$,
  '19. the rejected no-email insert left no partial profile behind'
);

select * from finish();
rollback;
