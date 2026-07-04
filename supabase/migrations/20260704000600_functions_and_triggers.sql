create or replace function private.is_active_member(
  user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_members as membership
    where membership.user_id = $1
      and membership.is_active = true
  );
$$;

create or replace function private.is_admin(
  user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_members as membership
    where membership.user_id = $1
      and membership.is_active = true
      and membership.role = 'admin'::public.membership_role
  );
$$;

revoke all on function private.is_active_member(uuid) from public, anon, authenticated;
revoke all on function private.is_admin(uuid) from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger z_profiles_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger z_app_content_updated_at
before update on public.app_content
for each row execute function private.set_updated_at();

create trigger z_games_updated_at
before update on public.games
for each row execute function private.set_updated_at();

create trigger z_ratings_updated_at
before update on public.ratings
for each row execute function private.set_updated_at();

create trigger z_meetings_updated_at
before update on public.meetings
for each row execute function private.set_updated_at();

create trigger z_meeting_availability_updated_at
before update on public.meeting_availability
for each row execute function private.set_updated_at();

create trigger z_plays_updated_at
before update on public.plays
for each row execute function private.set_updated_at();

create or replace function private.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.created_at is distinct from old.created_at then
    raise exception 'Profile id and created_at are immutable'
      using errcode = '42501';
  end if;

  if auth.uid() is not null and not private.is_admin(auth.uid()) then
    if new.email is distinct from old.email then
      raise exception 'Only display_name and avatar_url can be changed by a member'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger a_profiles_protect_system_fields
before update on public.profiles
for each row execute function private.protect_profile_fields();

create or replace function private.set_app_content_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger a_app_content_actor
before insert or update on public.app_content
for each row execute function private.set_app_content_actor();

create or replace function private.prevent_append_only_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;

create trigger point_events_append_only
before update or delete on public.point_events
for each row execute function private.prevent_append_only_mutation();

create trigger audit_log_append_only
before update or delete on public.audit_log
for each row execute function private.prevent_append_only_mutation();

create or replace function private.write_audit_log(
  p_actor_user_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_old_data jsonb,
  p_new_data jsonb
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  )
  values (
    p_actor_user_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_data,
    p_new_data
  );
$$;

create or replace function private.audit_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  old_snapshot jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_snapshot jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  target_id uuid;
  audit_action text;
begin
  if actor_id is null or not private.is_admin(actor_id) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  target_id := case tg_table_name
    when 'app_members' then coalesce(new_snapshot ->> 'user_id', old_snapshot ->> 'user_id')::uuid
    when 'play_participants' then coalesce(new_snapshot ->> 'play_id', old_snapshot ->> 'play_id')::uuid
    when 'app_content' then null
    else coalesce(new_snapshot ->> 'id', old_snapshot ->> 'id')::uuid
  end;

  audit_action := lower(tg_table_name || '.' || tg_op);

  if tg_table_name = 'games' and tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id then
      audit_action := 'game.owner_changed';
    elsif new.current_holder_id is distinct from old.current_holder_id then
      audit_action := 'game.current_holder_changed';
    elsif new.archived_at is distinct from old.archived_at then
      audit_action := 'game.archived_changed';
    else
      audit_action := 'game.updated';
    end if;
  elsif tg_table_name = 'app_members' and tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      audit_action := 'membership.role_changed';
    elsif new.is_active is distinct from old.is_active then
      audit_action := 'membership.active_changed';
    else
      audit_action := 'membership.updated';
    end if;
  elsif tg_table_name = 'point_events' and tg_op = 'INSERT' then
    audit_action := 'point_event.created';
  end if;

  perform private.write_audit_log(
    actor_id,
    audit_action,
    tg_table_name,
    target_id,
    old_snapshot,
    new_snapshot
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger audit_app_members_admin_changes
after insert or update or delete on public.app_members
for each row execute function private.audit_admin_change();

create trigger audit_games_admin_changes
after insert or update on public.games
for each row execute function private.audit_admin_change();

create trigger audit_meetings_admin_changes
after insert or update or delete on public.meetings
for each row execute function private.audit_admin_change();

create trigger audit_meeting_options_admin_changes
after insert or update or delete on public.meeting_options
for each row execute function private.audit_admin_change();

create trigger audit_plays_admin_changes
after insert or update or delete on public.plays
for each row execute function private.audit_admin_change();

create trigger audit_play_participants_admin_changes
after insert or update or delete on public.play_participants
for each row execute function private.audit_admin_change();

create trigger audit_app_content_admin_changes
after insert or update or delete on public.app_content
for each row execute function private.audit_admin_change();

create trigger audit_point_events_admin_changes
after insert on public.point_events
for each row execute function private.audit_admin_change();

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.protect_profile_fields() from public, anon, authenticated;
revoke all on function private.set_app_content_actor() from public, anon, authenticated;
revoke all on function private.prevent_append_only_mutation() from public, anon, authenticated;
revoke all on function private.write_audit_log(uuid, text, text, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.audit_admin_change() from public, anon, authenticated;
