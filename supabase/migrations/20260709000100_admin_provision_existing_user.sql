-- Incident fix (proposal, not yet applied anywhere): production accounts
-- created directly in the Supabase Dashboard ("Create new user" / "Invite
-- user" without manually typing matching User Metadata JSON) never carry
-- raw_user_meta_data.twoja_tura_invite = true, so private.provision_invited_
-- member() — correct and tested as-is, see pgTAP test "unmarked auth user is
-- not provisioned as an app member" — silently no-ops for them. That gate is
-- intentional (only pnpm invite:user's admin.inviteUserByEmail call sets the
-- flag) and is NOT weakened here. What was actually missing is an admin-safe
-- way to provision a legitimately-created-but-unflagged auth.users row after
-- the fact, without falling back to raw INSERTs or relaxing the trigger.
--
-- Cannot help the very first admin (no admin exists yet to authorize this
-- RPC) — that one-time bootstrap still requires a single reviewed manual SQL
-- statement, documented separately, run once by the project owner.

create or replace function public.admin_provision_existing_user(
  p_target_user_id uuid,
  p_role public.membership_role default 'member'::public.membership_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_display_name text;
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  select users.email, users.raw_user_meta_data ->> 'display_name'
  into v_email, v_display_name
  from auth.users as users
  where users.id = p_target_user_id;

  if not found then
    raise exception 'No auth.users row exists for %', p_target_user_id
      using errcode = 'P0002';
  end if;

  if v_email is null then
    raise exception 'auth.users row % has no email' , p_target_user_id
      using errcode = '22023';
  end if;

  insert into public.profiles (id, display_name, email)
  values (
    p_target_user_id,
    coalesce(nullif(btrim(v_display_name), ''), split_part(v_email, '@', 1)),
    v_email
  )
  on conflict (id) do nothing;

  insert into public.app_members (user_id, role, is_active)
  values (p_target_user_id, p_role, true)
  on conflict (user_id) do nothing;

  insert into public.admin_audit_log (
    actor_user_id, target_user_id, action_type, new_value
  )
  values (
    auth.uid(),
    p_target_user_id,
    'manual_provision',
    jsonb_build_object('role', p_role)
  );
end;
$$;

revoke all on function public.admin_provision_existing_user(uuid, public.membership_role)
  from public, anon, authenticated;
grant execute on function public.admin_provision_existing_user(uuid, public.membership_role)
  to authenticated;
