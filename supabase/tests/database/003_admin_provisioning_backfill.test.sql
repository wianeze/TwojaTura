begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

-- Reproduces the production incident: an auth.users row created without
-- raw_user_meta_data.twoja_tura_invite (e.g. Supabase Dashboard "Create new
-- user") — private.provision_invited_member() correctly no-ops for it (see
-- 001_security_and_rls.test.sql, "unmarked auth user is not provisioned as
-- an app member"). admin_provision_existing_user() is the safe way an admin
-- backfills it after the fact, without touching auth.users or the trigger.

-- Kuba (seeded as a plain member) is promoted to observer for this file only
-- — needed to prove observers are rejected exactly like ordinary members,
-- not just "any non-admin".
update public.app_members set role = 'observer' where user_id = '10000000-0000-0000-0000-000000000005';

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '91000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'dashboard-created@twojatura.local',
  extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Utworzony z Dashboardu"}',
  now(), now()
);

select ok(
  not exists (
    select 1 from public.profiles
    where id = '91000000-0000-0000-0000-000000000001'
  ),
  '1. Dashboard-style user is not auto-provisioned (confirms the reproduction)'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_provision_existing_user('91000000-0000-0000-0000-000000000001', 'member'::public.membership_role)$$,
  '42501',
  null,
  '2. an ordinary member cannot backfill provisioning'
);
select throws_ok(
  $$select public.admin_provision_existing_user('91000000-0000-0000-0000-000000000001', 'admin'::public.membership_role)$$,
  '42501',
  null,
  '3. a member cannot use this RPC to bootstrap themselves (or anyone) straight to admin'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.admin_provision_existing_user('91000000-0000-0000-0000-000000000001', 'member'::public.membership_role)$$,
  '42501',
  null,
  '4. an observer cannot backfill provisioning either'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.admin_provision_existing_user('00000000-0000-0000-0000-000000000099', 'member'::public.membership_role)$$,
  'P0002',
  null,
  '5. backfilling an unknown auth.users id raises a not-found error'
);

select lives_ok(
  $$select public.admin_provision_existing_user('91000000-0000-0000-0000-000000000001', 'member'::public.membership_role)$$,
  '6. an existing admin backfills the orphaned Dashboard-created user'
);

select results_eq(
  $$select display_name, email from public.profiles where id = '91000000-0000-0000-0000-000000000001'$$,
  $$values ('Utworzony z Dashboardu', 'dashboard-created@twojatura.local')$$,
  '7. the backfilled profile uses the auth.users email and metadata display name'
);

select results_eq(
  $$select role, is_active from public.app_members where user_id = '91000000-0000-0000-0000-000000000001'$$,
  $$values ('member'::public.membership_role, true)$$,
  '8. the backfilled membership is active with the requested role'
);

select results_eq(
  $$
    select count(*)::bigint from public.admin_audit_log
    where target_user_id = '91000000-0000-0000-0000-000000000001'
      and action_type = 'manual_provision'
  $$,
  $$values (1::bigint)$$,
  '9. the backfill is recorded in the audit log'
);

select lives_ok(
  $$select public.admin_provision_existing_user('91000000-0000-0000-0000-000000000001', 'member'::public.membership_role)$$,
  '10. re-running the backfill on an already-provisioned user is a harmless no-op'
);

select results_eq(
  $$select count(*)::bigint from public.profiles where id = '91000000-0000-0000-0000-000000000001'$$,
  $$values (1::bigint)$$,
  '11. the retry does not duplicate the profile row'
);

select results_eq(
  $$select count(*)::bigint from public.app_members where user_id = '91000000-0000-0000-0000-000000000001'$$,
  $$values (1::bigint)$$,
  '12. the retry does not duplicate the membership row'
);

select results_eq(
  $$
    select count(*)::bigint from public.admin_audit_log
    where target_user_id = '91000000-0000-0000-0000-000000000001'
      and action_type = 'manual_provision'
  $$,
  $$values (2::bigint)$$,
  '13. every call is still individually audit-logged, even a no-op retry'
);

-- A second orphaned user, provisioned directly into a non-default role.
-- auth.users has no INSERT grant for `authenticated` (correctly — GoTrue's
-- service role owns that table in a real deployment), so this needs the
-- unrestricted connecting role back, same as the very first insert above.
reset role;
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '91000000-0000-0000-0000-000000000002',
  'authenticated', 'authenticated', 'second-dashboard-user@twojatura.local',
  extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.admin_provision_existing_user('91000000-0000-0000-0000-000000000002', 'observer'::public.membership_role)$$,
  '14. an admin can backfill a second orphaned user directly into a non-default role'
);

select results_eq(
  $$select role from public.app_members where user_id = '91000000-0000-0000-0000-000000000002'$$,
  $$values ('observer'::public.membership_role)$$,
  '15. the requested non-default role is honored'
);

select results_eq(
  $$select display_name from public.profiles where id = '91000000-0000-0000-0000-000000000002'$$,
  $$values ('second-dashboard-user')$$,
  '16. a missing display_name metadata field falls back to the email local-part'
);

-- A third orphaned user, provisioned with the role argument omitted —
-- confirms the function's default parameter (p_role = 'member') actually
-- takes effect when a caller doesn't pass one explicitly.
reset role;
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '91000000-0000-0000-0000-000000000003',
  'authenticated', 'authenticated', 'third-dashboard-user@twojatura.local',
  extensions.crypt('TwojaTura123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.admin_provision_existing_user('91000000-0000-0000-0000-000000000003')$$,
  '17. omitting the role argument still succeeds'
);

select results_eq(
  $$select role from public.app_members where user_id = '91000000-0000-0000-0000-000000000003'$$,
  $$values ('member'::public.membership_role)$$,
  '18. the omitted role argument resolved to the member default'
);
reset role;

select * from finish();
rollback;
