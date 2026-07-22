create or replace function public.award_play_result_achievements(
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

  if participant_count >= 2
    and participant_count = placed_participant_count
    and last_placement is not null then
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
  end if;

  for participant in
    select current_participant.user_id
    from public.play_participants as current_participant
    join public.plays as current_play
      on current_play.id = current_participant.play_id
    where current_participant.play_id = p_play_id
      and private.is_active_member(current_participant.user_id)
      and (
        select count(*) = 3 and bool_and(recent_result.won)
        from (
          select
            history_participant.placement = 1
              or history_participant.is_winner as won
          from public.play_participants as history_participant
          join public.plays as history_play
            on history_play.id = history_participant.play_id
          where history_participant.user_id = current_participant.user_id
            and (
              history_play.played_at,
              history_play.created_at,
              history_play.id
            ) <= (
              current_play.played_at,
              current_play.created_at,
              current_play.id
            )
          order by
            history_play.played_at desc,
            history_play.created_at desc,
            history_play.id desc
          limit 3
        ) as recent_result
      )
  loop
    select * into result
    from private.award_achievement_once(
      participant.user_id,
      'dark_urge',
      'play_result_streak',
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
