create unique index point_events_once_per_related_idx
  on public.point_events (
    user_id,
    action_type,
    related_entity_type,
    related_entity_id
  )
  where related_entity_type is not null
    and related_entity_id is not null
    and action_type <> 'admin_adjustment';

create or replace function private.point_reward_for(p_action_type text)
returns integer
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
begin
  case p_action_type
    when 'shelf_first_game' then return 40;
    when 'shelf_5_games' then return 30;
    when 'shelf_10_games' then return 20;
    when 'shelf_15_games' then return 15;
    when 'meeting_rsvp' then return 10;
    when 'meeting_vote' then return 10;
    when 'meeting_created' then return 25;
    when 'rating_created' then return 30;
    when 'play_logged' then return 40;
    else
      raise exception 'Unsupported point action type: %', p_action_type
        using errcode = '22023';
  end case;
end;
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

revoke all on function private.point_reward_for(text)
from public, anon, authenticated;

revoke all on function private.award_points_once(uuid, text, text, uuid, text, uuid)
from public, anon, authenticated;
