create function public.award_play_result_achievements(
  p_play_id uuid
)
returns table (
  awarded_count integer,
  points_awarded integer,
  awarded_user_ids uuid[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  result record;
  participant record;
  participant_count integer;
  placed_participant_count integer;
  last_placement smallint;
  total_awarded integer := 0;
  total_points integer := 0;
  recipients uuid[] := array[]::uuid[];
begin
  if current_user_id is null or not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  if p_play_id is null or not exists (
    select 1
    from public.plays as play
    where play.id = p_play_id
  ) then
    raise exception 'Play does not exist'
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.plays as play
    where play.id = p_play_id
      and (play.created_by = current_user_id or private.is_admin(current_user_id))
  ) then
    raise exception 'Only the play author or an administrator can award play result achievements'
      using errcode = '42501';
  end if;

  select
    count(*),
    count(*) filter (where ranked_participant.placement is not null),
    max(ranked_participant.placement)
  into participant_count, placed_participant_count, last_placement
  from public.play_participants as ranked_participant
  where ranked_participant.play_id = p_play_id;

  if participant_count < 2
    or participant_count <> placed_participant_count
    or last_placement is null then
    return query select total_awarded, total_points, recipients;
    return;
  end if;

  for participant in
    select play_participant.user_id
    from public.play_participants as play_participant
    where play_participant.play_id = p_play_id
      and play_participant.placement = last_placement
      and private.is_active_member(play_participant.user_id)
  loop
    select * into result
    from private.award_achievement_once(
      participant.user_id,
      'natural_one',
      'play_result',
      p_play_id,
      null,
      current_user_id
    );

    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      recipients := array_append(recipients, participant.user_id);
    end if;
  end loop;

  return query select total_awarded, total_points, recipients;
end;
$$;

revoke all on function public.award_play_result_achievements(uuid)
from public, anon, authenticated;

grant execute on function public.award_play_result_achievements(uuid)
to authenticated;
