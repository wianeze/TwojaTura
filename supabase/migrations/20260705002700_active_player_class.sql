alter table public.profiles
  add column active_class_key text null;

alter table public.profiles
  add constraint profiles_active_class_key_fkey
  foreign key (active_class_key)
  references public.class_definitions (class_key)
  on update cascade
  on delete set null;

create index profiles_active_class_key_idx
  on public.profiles (active_class_key)
  where active_class_key is not null;

-- Members keep the existing editable profile fields, while active_class_key can
-- only be changed through the narrow RPC below.
revoke update on table public.profiles from authenticated;
grant update (display_name, avatar_url, email) on table public.profiles
to authenticated;

create or replace function public.set_active_class(p_class_key text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  required_count integer;
  earned_count integer;
begin
  if current_user_id is null or not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  if p_class_key is null then
    update public.profiles
    set active_class_key = null
    where id = current_user_id;

    return null;
  end if;

  if not exists (
    select 1
    from public.class_definitions as definition
    where definition.class_key = p_class_key
      and definition.is_active = true
  ) then
    raise exception 'Class definition is missing or inactive: %', p_class_key
      using errcode = '22023';
  end if;

  select count(*)::integer
  into required_count
  from public.class_requirements as requirement
  where requirement.class_key = p_class_key;

  if required_count = 0 then
    raise exception 'Class has no unlock requirements: %', p_class_key
      using errcode = '22023';
  end if;

  select count(*)::integer
  into earned_count
  from public.class_requirements as requirement
  join public.user_achievements as earned
    on earned.achievement_key = requirement.achievement_key
   and earned.user_id = current_user_id
  where requirement.class_key = p_class_key;

  if earned_count <> required_count then
    raise exception 'Class is not unlocked: %', p_class_key
      using errcode = '42501';
  end if;

  update public.profiles
  set active_class_key = p_class_key
  where id = current_user_id;

  return p_class_key;
end;
$$;

revoke all on function public.set_active_class(text)
from public, anon, authenticated;

grant execute on function public.set_active_class(text)
to authenticated;
