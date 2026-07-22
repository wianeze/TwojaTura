create function public.award_meeting_achievements(
  p_play_id uuid
)
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
  meeting_host_id uuid;
  completed_meeting_count integer;
  result record;
  total_awarded integer := 0;
  total_points integer := 0;
  keys text[] := array[]::text[];
begin
  if current_user_id is null or not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  if p_play_id is null then
    raise exception 'Play is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.plays as play
    where play.id = p_play_id
      and (play.created_by = current_user_id or private.is_admin(current_user_id))
  ) then
    raise exception 'Only the play author or an administrator can award meeting achievements'
      using errcode = '42501';
  end if;

  select meeting.created_by
  into meeting_host_id
  from public.plays as play
  join public.meetings as meeting on meeting.id = play.meeting_id
  where play.id = p_play_id;

  if meeting_host_id is null then
    return query select total_awarded, total_points, keys;
    return;
  end if;

  select count(*)
  into completed_meeting_count
  from public.meetings as meeting
  where meeting.created_by = meeting_host_id
    and exists (
      select 1
      from public.plays as play
      where play.meeting_id = meeting.id
    );

  if completed_meeting_count >= 5 then
    select * into result
    from private.award_achievement_once(
      meeting_host_id,
      'camp_host',
      'meeting_completion',
      meeting_host_id,
      null,
      current_user_id
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

revoke all on function public.award_meeting_achievements(uuid)
from public, anon, authenticated;

grant execute on function public.award_meeting_achievements(uuid)
to authenticated;
