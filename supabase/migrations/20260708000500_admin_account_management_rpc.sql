-- Etap D5: /admin panel RPCs. No hard delete and no service-role usage —
-- "deleting" an account always means app_members.is_active = false plus
-- profile anonymization, preserving every historical row (games, plays,
-- points, photos, achievements) exactly as CLAUDE.md and the approved plan
-- require. auth.users is only ever read here (for last_sign_in_at), never
-- written — these functions run SECURITY DEFINER so they can see the auth
-- schema, but that privilege is not exposed beyond the specific safe
-- columns selected below.

create or replace function public.admin_list_accounts(
  p_search text default null,
  p_role_filter public.membership_role default null
)
returns table (
  user_id uuid,
  display_name text,
  email text,
  role public.membership_role,
  is_active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.email,
    m.role,
    m.is_active,
    m.joined_at,
    u.last_sign_in_at
  from public.profiles as p
  join public.app_members as m on m.user_id = p.id
  join auth.users as u on u.id = p.id
  where (p_role_filter is null or m.role = p_role_filter)
    and (
      p_search is null
      or length(btrim(p_search)) = 0
      or p.display_name ilike '%' || btrim(p_search) || '%'
      or p.email ilike '%' || btrim(p_search) || '%'
    )
  order by p.created_at desc;
end;
$$;

create or replace function public.admin_change_role(
  p_target_user_id uuid,
  p_new_role public.membership_role,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_role public.membership_role;
  v_remaining_admins integer;
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  select role into v_old_role
  from public.app_members
  where user_id = p_target_user_id;

  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;

  if v_old_role = p_new_role then
    return;
  end if;

  -- An admin may not strip their own admin role — they'd otherwise be able
  -- to accidentally lock themselves out of /admin with no one able to
  -- reverse it (the *other* guard below only fires when they're the last
  -- one; this one fires unconditionally for self-demotion).
  if p_target_user_id = auth.uid() and v_old_role = 'admin'::public.membership_role then
    raise exception 'You cannot remove your own administrator role'
      using errcode = '42501';
  end if;

  if v_old_role = 'admin'::public.membership_role then
    select count(*) into v_remaining_admins
    from public.app_members
    where role = 'admin'::public.membership_role
      and is_active = true
      and user_id <> p_target_user_id;

    if v_remaining_admins = 0 then
      raise exception 'This is the last active administrator — the role cannot be changed'
        using errcode = '42501';
    end if;
  end if;

  update public.app_members
  set role = p_new_role
  where user_id = p_target_user_id;

  insert into public.admin_audit_log (
    actor_user_id, target_user_id, action_type, old_value, new_value, reason
  )
  values (
    auth.uid(),
    p_target_user_id,
    'role_change',
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_new_role),
    p_reason
  );
end;
$$;

create or replace function public.admin_deactivate_and_anonymize_account(
  p_target_user_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.membership_role;
  v_is_active boolean;
  v_remaining_admins integer;
  v_old_snapshot jsonb;
  v_anon_suffix text;
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  if p_target_user_id = auth.uid() then
    raise exception 'You cannot deactivate your own account' using errcode = '42501';
  end if;

  select role, is_active into v_role, v_is_active
  from public.app_members
  where user_id = p_target_user_id;

  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;

  if not v_is_active then
    -- Already deactivated — idempotent no-op rather than an error, so a
    -- retried click after a network hiccup doesn't surface a scary message.
    return;
  end if;

  if v_role = 'admin'::public.membership_role then
    select count(*) into v_remaining_admins
    from public.app_members
    where role = 'admin'::public.membership_role
      and is_active = true
      and user_id <> p_target_user_id;

    if v_remaining_admins = 0 then
      raise exception 'This is the last active administrator — the account cannot be deactivated'
        using errcode = '42501';
    end if;
  end if;

  select jsonb_build_object('display_name', display_name, 'email', email)
  into v_old_snapshot
  from public.profiles
  where id = p_target_user_id;

  v_anon_suffix := substr(p_target_user_id::text, 1, 8);

  update public.app_members
  set is_active = false
  where user_id = p_target_user_id;

  update public.profiles
  set
    display_name = 'Usunięty użytkownik',
    email = 'usuniety-' || v_anon_suffix || '@deleted.local',
    avatar_url = null
  where id = p_target_user_id;

  insert into public.admin_audit_log (
    actor_user_id, target_user_id, action_type, old_value, reason
  )
  values (
    auth.uid(),
    p_target_user_id,
    'account_deactivated_anonymized',
    v_old_snapshot,
    p_reason
  );
end;
$$;

revoke all on function public.admin_list_accounts(text, public.membership_role)
  from public, anon, authenticated;
revoke all on function public.admin_change_role(uuid, public.membership_role, text)
  from public, anon, authenticated;
revoke all on function public.admin_deactivate_and_anonymize_account(uuid, text)
  from public, anon, authenticated;

grant execute on function public.admin_list_accounts(text, public.membership_role) to authenticated;
grant execute on function public.admin_change_role(uuid, public.membership_role, text) to authenticated;
grant execute on function public.admin_deactivate_and_anonymize_account(uuid, text) to authenticated;
