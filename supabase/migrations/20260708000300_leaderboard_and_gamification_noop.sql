-- Etap D3: hidden accounts (admin/observer) never rank, never earn points,
-- never earn achievements — enforced centrally in the two functions that
-- actually write point_events/user_achievements, so every current and
-- future call path (self-service RPCs, admin manual adjustments) is
-- automatically covered without needing a matching guard at each call site.
-- Also closes two self-service write RPCs (set_active_class,
-- reorder_play_photos) whose only gate today is is_active_member(), which
-- observers satisfy — they need private.current_user_can_write() instead,
-- same as every table-level write policy in the previous migration.

create or replace function public.get_leaderboard()
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  total_points bigint,
  rank bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with balances as (
    select
      profiles.id as user_id,
      profiles.display_name,
      profiles.avatar_url,
      coalesce(sum(events.points), 0)::bigint as total_points
    from public.app_members as membership
    join public.profiles as profiles
      on profiles.id = membership.user_id
    left join public.point_events as events
      on events.user_id = membership.user_id
    where private.is_active_member(auth.uid())
      and membership.is_active = true
      and membership.role = 'member'::public.membership_role
    group by profiles.id, profiles.display_name, profiles.avatar_url
  ), ranked as (
    select
      balances.user_id,
      balances.display_name,
      balances.avatar_url,
      balances.total_points,
      rank() over (
        order by balances.total_points desc, balances.display_name, balances.user_id
      )::bigint as leaderboard_rank
    from balances
  )
  select
    ranked.user_id,
    ranked.display_name,
    ranked.avatar_url,
    ranked.total_points,
    ranked.leaderboard_rank as rank
  from ranked
  order by ranked.leaderboard_rank, ranked.display_name, ranked.user_id;
$$;

create or replace function private.award_points_once(
  p_user_id uuid,
  p_action_type text,
  p_related_entity_type text,
  p_related_entity_id uuid,
  p_description text default null,
  p_created_by uuid default auth.uid()
)
returns table (
  awarded boolean,
  points integer,
  point_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  awarded_points integer;
  inserted_event_id uuid;
  event_created_by uuid;
begin
  if p_user_id is null then
    raise exception 'Point recipient is required' using errcode = '22023';
  end if;

  if p_related_entity_type is null
    or length(btrim(p_related_entity_type)) = 0
    or p_related_entity_id is null then
    raise exception 'Related entity type and id are required'
      using errcode = '22023';
  end if;

  if not private.is_active_member(p_user_id) then
    raise exception 'Point recipient must be an active member'
      using errcode = '42501';
  end if;

  -- Hidden accounts (admin/observer) never accrue points, regardless of
  -- which call path reached this function. Silent no-op, not an error —
  -- callers treat "awarded = false" the same way they do for an idempotent
  -- repeat, so nothing upstream needs to special-case this.
  if private.is_admin(p_user_id) or private.is_observer(p_user_id) then
    return query select false, 0, null::uuid;
    return;
  end if;

  awarded_points := private.point_reward_for(p_action_type);
  event_created_by := coalesce(p_created_by, p_user_id);

  insert into public.point_events (
    user_id,
    points,
    action_type,
    description,
    related_entity_type,
    related_entity_id,
    created_by
  )
  values (
    p_user_id,
    awarded_points,
    p_action_type,
    p_description,
    btrim(p_related_entity_type),
    p_related_entity_id,
    event_created_by
  )
  on conflict do nothing
  returning id into inserted_event_id;

  return query
  select
    inserted_event_id is not null,
    awarded_points,
    inserted_event_id;
end;
$$;

create or replace function private.award_achievement_once(
  p_user_id uuid,
  p_achievement_key text,
  p_source_event_type text default null,
  p_source_entity_id uuid default null,
  p_note text default null,
  p_awarded_by uuid default auth.uid()
)
returns table (
  awarded boolean,
  achievement_key text,
  awarded_at timestamptz,
  points_awarded integer,
  point_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  definition_name text;
  definition_points integer;
  inserted_at timestamptz;
  inserted_event_id uuid;
  event_created_by uuid;
begin
  if p_user_id is null then
    raise exception 'Achievement recipient is required' using errcode = '22023';
  end if;

  if not private.is_active_member(p_user_id) then
    raise exception 'Achievement recipient must be an active member'
      using errcode = '42501';
  end if;

  -- Same centralized no-op as award_points_once above, and for the same
  -- reason: one choke point for every current and future achievement path.
  if private.is_admin(p_user_id) or private.is_observer(p_user_id) then
    return query select false, p_achievement_key, null::timestamptz, 0, null::uuid;
    return;
  end if;

  select definition.name, definition.points
  into definition_name, definition_points
  from public.achievement_definitions as definition
  where definition.achievement_key = p_achievement_key
    and definition.is_active = true;

  if not found then
    raise exception 'Achievement definition is missing or inactive: %', p_achievement_key
      using errcode = '22023';
  end if;

  event_created_by := coalesce(p_awarded_by, p_user_id);

  insert into public.user_achievements (
    user_id,
    achievement_key,
    awarded_by,
    source_event_type,
    source_entity_id,
    note
  )
  values (
    p_user_id,
    p_achievement_key,
    event_created_by,
    p_source_event_type,
    p_source_entity_id,
    p_note
  )
  on conflict on constraint user_achievements_pkey do nothing
  returning user_achievements.awarded_at into inserted_at;

  if inserted_at is not null and definition_points > 0 then
    insert into public.point_events (
      user_id,
      points,
      action_type,
      description,
      related_entity_type,
      related_entity_id,
      created_by
    )
    values (
      p_user_id,
      definition_points,
      'achievement_unlocked:' || p_achievement_key,
      'Odznaka: ' || definition_name,
      'profile',
      p_user_id,
      event_created_by
    )
    on conflict do nothing
    returning id into inserted_event_id;
  end if;

  return query
  select
    inserted_at is not null,
    p_achievement_key,
    inserted_at,
    case when inserted_event_id is not null then definition_points else 0 end,
    inserted_event_id;
end;
$$;

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
  if current_user_id is null or not private.current_user_can_write() then
    raise exception 'Write access is required'
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

create or replace function public.reorder_play_photos(
  p_play_id uuid,
  p_photo_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  existing_ids uuid[];
  requested_sorted uuid[];
  existing_sorted uuid[];
  photo_id uuid;
  next_position integer := 0;
begin
  if current_user_id is null or not private.current_user_can_write() then
    raise exception 'Write access is required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.plays
    where id = p_play_id
      and (created_by = current_user_id or private.is_admin(current_user_id))
  ) then
    raise exception 'Only the play author or an administrator can reorder photos'
      using errcode = '42501';
  end if;

  select coalesce(array_agg(id), array[]::uuid[])
  into existing_ids
  from public.play_photos
  where play_id = p_play_id;

  select coalesce(array_agg(x order by x), array[]::uuid[])
  into requested_sorted
  from unnest(coalesce(p_photo_ids, array[]::uuid[])) as x;

  select coalesce(array_agg(x order by x), array[]::uuid[])
  into existing_sorted
  from unnest(existing_ids) as x;

  if requested_sorted <> existing_sorted then
    raise exception 'Photo order must reference exactly the play''s existing photos'
      using errcode = '22023';
  end if;

  foreach photo_id in array p_photo_ids
  loop
    next_position := next_position + 1;
    update public.play_photos
    set position = next_position
    where id = photo_id
      and play_id = p_play_id;
  end loop;
end;
$$;
