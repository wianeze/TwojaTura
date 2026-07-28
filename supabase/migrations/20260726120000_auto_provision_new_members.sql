-- Policy reversal (deliberate, on explicit product-owner instruction):
-- 20260709000100_admin_provision_existing_user.sql added an admin-only RPC
-- to backfill a single orphaned auth.users row *specifically because* it
-- judged the raw_user_meta_data.twoja_tura_invite gate on
-- private.provision_invited_member() "intentional" and explicitly said it
-- was "NOT weakened" by that migration. This migration reverses that
-- decision: production account creation only ever happens through an
-- already-admin-gated surface (Supabase Dashboard "Create new user" / "Send
-- invitation", or the Admin API — see supabase/config.toml,
-- enable_signup = false and enable_anonymous_sign_ins = false, so
-- auth.users can never be populated by an unauthenticated visitor), so the
-- metadata flag was adding friction without adding safety. Every new
-- auth.users row now self-provisions as an active member, no flag required.
--
-- admin_provision_existing_user() and admin_change_role() (both from
-- 20260709000100 / 20260708000500) are left completely untouched — still
-- useful for admins who want to hand a brand-new account a non-default role
-- immediately, or to fix up historical accounts a second time by hand.

create or replace function private.provision_invited_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or length(btrim(new.email)) = 0 then
    raise exception 'Twoja Tura account requires an email address';
  end if;

  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;

  insert into public.app_members (user_id, role, is_active)
  values (new.id, 'member'::public.membership_role, true)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Trigger on_auth_user_invited (20260704000900) already points at this
-- function by name and needs no change: CREATE OR REPLACE FUNCTION keeps
-- the function's OID, so the existing AFTER INSERT trigger picks up this
-- new body automatically.

-- One-time, idempotent backfill for auth.users rows that predate this
-- migration and were never provisioned (the exact production incident this
-- change fixes). Never touches a row that already has a profiles or
-- app_members record — role, is_active, and every other column of an
-- existing app_members row are left completely alone, regardless of what
-- they currently are (admin, observer, inactive member, ...). Safe to
-- re-run: the second call finds nothing left to insert.
create or replace function private.backfill_unprovisioned_members()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  select
    u.id,
    coalesce(nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1)),
    u.email
  from auth.users as u
  left join public.profiles as p on p.id = u.id
  where p.id is null
    and u.email is not null
    and length(btrim(u.email)) > 0
  on conflict (id) do nothing;

  insert into public.app_members (user_id, role, is_active)
  select p.id, 'member'::public.membership_role, true
  from public.profiles as p
  left join public.app_members as m on m.user_id = p.id
  where m.user_id is null
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function private.backfill_unprovisioned_members() from public, anon, authenticated;

-- Run the backfill once, now, as part of applying this migration.
select private.backfill_unprovisioned_members();
