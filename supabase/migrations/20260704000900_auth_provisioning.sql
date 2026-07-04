create or replace function public.get_own_membership_status()
returns table (
  role public.membership_role,
  is_active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select membership.role, membership.is_active
  from public.app_members as membership
  where membership.user_id = auth.uid();
$$;

revoke all on function public.get_own_membership_status() from public, anon;
grant execute on function public.get_own_membership_status() to authenticated;

create or replace function private.provision_invited_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  if coalesce(new.raw_user_meta_data ->> 'twoja_tura_invite', 'false') <> 'true' then
    return new;
  end if;

  if new.email is null then
    raise exception 'Twoja Tura invite requires an email address';
  end if;

  requested_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if requested_name = '' then
    requested_name := split_part(new.email, '@', 1);
  end if;

  insert into public.profiles (id, display_name, email)
  values (new.id, requested_name, new.email)
  on conflict (id) do nothing;

  insert into public.app_members (user_id, role, is_active)
  values (new.id, 'member'::public.membership_role, true)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_invited on auth.users;
create trigger on_auth_user_invited
after insert on auth.users
for each row execute function private.provision_invited_member();

revoke all on function private.provision_invited_member() from public, anon, authenticated;
