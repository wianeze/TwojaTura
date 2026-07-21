drop function private.award_achievement_once(uuid, text, text, uuid, text, uuid);

create function private.award_achievement_once(
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

revoke all on function private.award_achievement_once(uuid, text, text, uuid, text, uuid)
from public, anon, authenticated;

create function public.award_current_user_simple_achievements()
returns table (
  awarded_count integer,
  points_awarded integer,
  awarded_keys text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  result record;
  total_awarded integer := 0;
  total_points integer := 0;
  keys text[] := array[]::text[];
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.play_participants as participant
    where participant.user_id = current_user_id
      and participant.is_winner = true
  ) then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'critical_roll', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if (select count(*) from public.meetings where created_by = current_user_id) >= 5 then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'initiative_master', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if (
    select count(*)
    from public.ratings
    where user_id = current_user_id
      and nullif(btrim(comment), '') is not null
  ) >= 10 then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'party_bard', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if (select count(*) from public.plays where created_by = current_user_id) >= 25 then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'coast_chronicler', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if exists (
    select 1
    from public.play_participants as participant
    join public.plays as play on play.id = participant.play_id
    where participant.user_id = current_user_id
    group by (play.played_at at time zone 'Europe/Warsaw')::date
    having count(*) >= 2
  ) then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'short_rest', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if exists (
    select 1
    from public.play_participants as participant
    where participant.user_id = current_user_id
      and (
        select count(*)
        from public.play_participants as party
        where party.play_id = participant.play_id
      ) >= 5
  ) then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'full_party', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if exists (
    select 1
    from public.play_participants as participant
    where participant.user_id = current_user_id
      and (
        select count(*)
        from public.play_participants as party
        where party.play_id = participant.play_id
      ) = 1
  ) then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'lone_wolf', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if exists (
    select 1
    from public.plays
    where created_by = current_user_id
      and meeting_id is null
  ) then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'side_quest', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if (
    select count(*)
    from public.meeting_availability
    where user_id = current_user_id
      and is_available is not null
  ) >= 10 then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'guidance', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if (
    select count(*)
    from public.games
    where owner_id = current_user_id
      and archived_at is null
  ) >= 25 then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'loot_goblin', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if (
    select count(*)
    from public.games
    where owner_id = current_user_id
      and archived_at is null
  ) >= 50 then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'bag_of_holding', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if (
    select count(distinct game_id)
    from public.ratings
    where user_id = current_user_id
      and overall = 10
  ) >= 5 then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'fanboy', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if (
    select count(distinct game_id)
    from public.ratings
    where user_id = current_user_id
      and wants_to_play_again = true
  ) >= 20 then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'one_more_turn', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  return query select total_awarded, total_points, keys;
end;
$$;

revoke all on function public.award_current_user_simple_achievements()
from public, anon, authenticated;
grant execute on function public.award_current_user_simple_achievements()
to authenticated;
