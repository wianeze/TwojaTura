-- Admin-only, read-only snapshot reconstructed from durable business rows.
-- This is deliberately separate from first-party telemetry: it never writes
-- synthetic usage_events/audit_events and does not claim to represent page
-- views, clicks, sessions or a complete history of mutable responses.

create or replace function public.admin_historical_business_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_snapshot jsonb;
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  with
  valid_meetings as materialized (
    select meeting.*
    from public.meetings as meeting
    where meeting.deleted_at is null
  ),
  business_events as materialized (
    select
      meeting.created_by as user_id,
      meeting.created_at as occurred_at,
      'meeting_created'::text as event_type
    from valid_meetings as meeting

    union all

    select proposal.proposed_by, proposal.created_at, 'game_proposed'
    from public.meeting_game_proposals as proposal
    join valid_meetings as meeting on meeting.id = proposal.meeting_id

    union all

    select proposal.proposed_by, proposal.created_at, 'continuation_proposed'
    from public.meeting_continuation_proposals as proposal
    join valid_meetings as meeting on meeting.id = proposal.meeting_id

    union all

    -- meeting_availability is a current-state row. updated_at is the time of
    -- the last stored decision, not a history of every RSVP change.
    select availability.user_id, availability.updated_at, 'rsvp_state'
    from public.meeting_availability as availability
    join valid_meetings as meeting on meeting.id = availability.meeting_id

    union all

    -- Responses preserve one row per user/candidate. created_at represents
    -- the first stored response; later yes/no changes are not separate events.
    select response.user_id, response.created_at, 'game_response_state'
    from public.meeting_game_responses as response
    join valid_meetings as meeting on meeting.id = response.meeting_id

    union all

    select response.user_id, response.created_at, 'continuation_response_state'
    from public.meeting_continuation_responses as response
    join valid_meetings as meeting on meeting.id = response.meeting_id

    union all

    select play.created_by, play.created_at, 'chronicle_entry_created'
    from public.plays as play

    union all

    -- Participation is attributed to the day the game was played, not to the
    -- later moment when somebody may have completed the Chronicle entry.
    select participant.user_id, play.played_at, 'play_participation'
    from public.play_participants as participant
    join public.plays as play on play.id = participant.play_id

    union all

    select rating.user_id, rating.created_at, 'rating_created'
    from public.ratings as rating

    union all

    -- games has no immutable created_by column; owner_id is the durable actor
    -- available in the current model and may reflect a later ownership change.
    select game.owner_id, game.created_at, 'game_registered'
    from public.games as game

    union all

    select loan.lender_user_id, loan.loaned_at, 'game_loaned'
    from public.game_loans as loan

    union all

    -- For Renown the user is the beneficiary, not necessarily the actor who
    -- initiated the underlying business operation.
    select event.user_id, event.created_at, 'renown_ledger_entry'
    from public.point_events as event
  ),
  weekly_activity as (
    select
      date_trunc(
        'week',
        event.occurred_at at time zone 'Europe/Warsaw'
      )::date as week_start,
      count(*)::bigint as records_count,
      count(distinct event.user_id)::bigint as active_users
    from business_events as event
    group by 1
  ),
  meetings_by_user as (
    select created_by as user_id, count(*)::bigint as meetings_created
    from valid_meetings
    group by created_by
  ),
  proposals_by_user as (
    select proposed_by as user_id, count(*)::bigint as proposals
    from public.meeting_game_proposals as proposal
    join valid_meetings as meeting on meeting.id = proposal.meeting_id
    group by proposed_by

    union all

    select proposed_by as user_id, count(*)::bigint as proposals
    from public.meeting_continuation_proposals as proposal
    join valid_meetings as meeting on meeting.id = proposal.meeting_id
    group by proposed_by
  ),
  proposal_totals_by_user as (
    select user_id, sum(proposals)::bigint as proposals
    from proposals_by_user
    group by user_id
  ),
  responses_by_user as (
    select availability.user_id, count(*)::bigint as responses
    from public.meeting_availability as availability
    join valid_meetings as meeting on meeting.id = availability.meeting_id
    group by availability.user_id

    union all

    select response.user_id, count(*)::bigint as responses
    from public.meeting_game_responses as response
    join valid_meetings as meeting on meeting.id = response.meeting_id
    group by response.user_id

    union all

    select response.user_id, count(*)::bigint as responses
    from public.meeting_continuation_responses as response
    join valid_meetings as meeting on meeting.id = response.meeting_id
    group by response.user_id
  ),
  response_totals_by_user as (
    select user_id, sum(responses)::bigint as responses
    from responses_by_user
    group by user_id
  ),
  plays_by_user as (
    select
      participant.user_id,
      count(*)::bigint as play_participations,
      count(*) filter (
        where play.status = 'completed'::public.play_status
          and participant.is_winner
      )::bigint as wins
    from public.play_participants as participant
    join public.plays as play on play.id = participant.play_id
    group by participant.user_id
  ),
  ratings_by_user as (
    select user_id, count(*)::bigint as ratings
    from public.ratings
    group by user_id
  ),
  games_by_user as (
    select owner_id as user_id, count(*)::bigint as games_added
    from public.games
    group by owner_id
  ),
  renown_by_user as (
    select user_id, coalesce(sum(points), 0)::bigint as renown_net
    from public.point_events
    group by user_id
  ),
  achievements_by_user as (
    select user_id, count(*)::bigint as achievements
    from public.user_achievements
    group by user_id
  ),
  player_activity as (
    select
      profile.id as user_id,
      profile.display_name,
      coalesce(meeting.meetings_created, 0)::bigint as meetings_created,
      coalesce(proposal.proposals, 0)::bigint as proposals,
      coalesce(response.responses, 0)::bigint as responses,
      coalesce(play.play_participations, 0)::bigint as play_participations,
      coalesce(play.wins, 0)::bigint as wins,
      coalesce(rating.ratings, 0)::bigint as ratings,
      coalesce(game.games_added, 0)::bigint as games_added,
      coalesce(renown.renown_net, 0)::bigint as renown_net,
      coalesce(achievement.achievements, 0)::bigint as achievements
    from public.profiles as profile
    left join meetings_by_user as meeting on meeting.user_id = profile.id
    left join proposal_totals_by_user as proposal on proposal.user_id = profile.id
    left join response_totals_by_user as response on response.user_id = profile.id
    left join plays_by_user as play on play.user_id = profile.id
    left join ratings_by_user as rating on rating.user_id = profile.id
    left join games_by_user as game on game.user_id = profile.id
    left join renown_by_user as renown on renown.user_id = profile.id
    left join achievements_by_user as achievement on achievement.user_id = profile.id
    where
      coalesce(meeting.meetings_created, 0)
      + coalesce(proposal.proposals, 0)
      + coalesce(response.responses, 0)
      + coalesce(play.play_participations, 0)
      + coalesce(rating.ratings, 0)
      + coalesce(game.games_added, 0)
      + abs(coalesce(renown.renown_net, 0))
      + coalesce(achievement.achievements, 0) > 0
  ),
  play_stats_by_game as (
    select
      play.game_id,
      count(distinct play.id)::bigint as plays_count,
      count(distinct participant.user_id)::bigint as unique_players,
      round(avg(play.duration_minutes) filter (
        where play.duration_minutes is not null
      ))::integer as average_duration_minutes
    from public.plays as play
    left join public.play_participants as participant
      on participant.play_id = play.id
    group by play.game_id
  ),
  rating_stats_by_game as (
    select
      rating.game_id,
      count(*)::bigint as ratings_count,
      round(avg(rating.overall)::numeric, 1) as average_rating
    from public.ratings as rating
    group by rating.game_id
  ),
  top_games as (
    select
      game.id as game_id,
      game.title,
      play.plays_count,
      play.unique_players,
      play.average_duration_minutes,
      coalesce(rating.ratings_count, 0)::bigint as ratings_count,
      rating.average_rating
    from play_stats_by_game as play
    join public.games as game on game.id = play.game_id
    left join rating_stats_by_game as rating on rating.game_id = play.game_id
    order by play.plays_count desc, play.unique_players desc, game.title
    limit 20
  ),
  renown_breakdown as (
    select
      event.action_type,
      case
        when event.action_type like 'admin\_award:%' escape '\'
          or event.action_type like 'admin\_reversal:%' escape '\'
          then 'admin_correction'
        when event.action_type like 'reversal:%'
          then 'business_reversal'
        when event.action_type like 'achievement\_unlocked:%' escape '\'
          then 'achievement'
        else 'reward'
      end as source_type,
      count(*)::bigint as events_count,
      sum(event.points)::bigint as points_total
    from public.point_events as event
    group by event.action_type, 2
  ),
  top_achievements as (
    select
      achievement.achievement_key,
      definition.name,
      definition.rarity,
      count(*)::bigint as awarded_count
    from public.user_achievements as achievement
    join public.achievement_definitions as definition
      on definition.achievement_key = achievement.achievement_key
    group by achievement.achievement_key, definition.name, definition.rarity
    order by awarded_count desc, definition.name
    limit 20
  ),
  response_state as (
    select jsonb_build_object(
      'rsvp_total', (
        select count(*)
        from public.meeting_availability as availability
        join valid_meetings as meeting on meeting.id = availability.meeting_id
      ),
      'rsvp_yes', (
        select count(*)
        from public.meeting_availability as availability
        join valid_meetings as meeting on meeting.id = availability.meeting_id
        where availability.is_available
      ),
      'game_responses_total', (
        select count(*)
        from public.meeting_game_responses as response
        join valid_meetings as meeting on meeting.id = response.meeting_id
      ),
      'game_responses_yes', (
        select count(*)
        from public.meeting_game_responses as response
        join valid_meetings as meeting on meeting.id = response.meeting_id
        where response.wants_to_play
      ),
      'continuation_responses_total', (
        select count(*)
        from public.meeting_continuation_responses as response
        join valid_meetings as meeting on meeting.id = response.meeting_id
      ),
      'continuation_responses_yes', (
        select count(*)
        from public.meeting_continuation_responses as response
        join valid_meetings as meeting on meeting.id = response.meeting_id
        where response.wants_to_play
      )
    ) as value
  )
  select jsonb_build_object(
    'source', 'derived',
    'generated_at', statement_timestamp(),
    'timezone', 'Europe/Warsaw',
    'data_since', (
      select min(event.occurred_at) from business_events as event
    ),
    'kpis', jsonb_build_object(
      'meetings', (select count(*) from valid_meetings),
      'plays', (select count(*) from public.plays),
      'ratings', (select count(*) from public.ratings),
      'games', (select count(*) from public.games),
      'renown_net', (select coalesce(sum(points), 0) from public.point_events),
      'achievements', (select count(*) from public.user_achievements),
      'loans', (select count(*) from public.game_loans),
      'feedback', (select count(*) from public.feedback_submissions)
    ),
    'weekly_activity', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'week_start', weekly.week_start,
          'records_count', weekly.records_count,
          'active_users', weekly.active_users
        )
        order by weekly.week_start
      )
      from weekly_activity as weekly
    ), '[]'::jsonb),
    'player_activity', coalesce((
      select jsonb_agg(
        to_jsonb(player)
        order by player.play_participations desc,
          player.meetings_created desc,
          player.ratings desc,
          player.display_name
      )
      from player_activity as player
    ), '[]'::jsonb),
    'top_games', coalesce((
      select jsonb_agg(to_jsonb(game))
      from top_games as game
    ), '[]'::jsonb),
    'renown_breakdown', coalesce((
      select jsonb_agg(
        to_jsonb(breakdown)
        order by abs(breakdown.points_total) desc, breakdown.action_type
      )
      from renown_breakdown as breakdown
    ), '[]'::jsonb),
    'renown_adjustments', jsonb_build_object(
      'admin_correction_points', (
        select coalesce(sum(event.points), 0)
        from public.point_events as event
        where event.action_type like 'admin\_award:%' escape '\'
          or event.action_type like 'admin\_reversal:%' escape '\'
      ),
      'business_reversal_points', (
        select coalesce(sum(event.points), 0)
        from public.point_events as event
        where event.action_type like 'reversal:%'
      ),
      'rebase_runs', (select count(*) from public.economy_rebase_runs),
      'rebase_points_delta', (
        select coalesce(sum(run.points_delta), 0)
        from public.economy_rebase_runs as run
      ),
      'rebase_events_written', (
        select coalesce(sum(run.events_written), 0)
        from public.economy_rebase_runs as run
      )
    ),
    'top_achievements', coalesce((
      select jsonb_agg(to_jsonb(achievement))
      from top_achievements as achievement
    ), '[]'::jsonb),
    'response_state', (select value from response_state),
    'quality', jsonb_build_object(
      'excluded_soft_deleted_meetings', (
        select count(*) from public.meetings where deleted_at is not null
      ),
      'responses_are_current_state', true,
      'achievement_dates_may_be_backfilled', true,
      'renown_dates_may_include_reconciliation', true,
      'game_owner_is_current_owner', true
    )
  ) into v_snapshot;

  return v_snapshot;
end;
$$;

revoke all on function public.admin_historical_business_snapshot()
from public, anon, authenticated;
grant execute on function public.admin_historical_business_snapshot()
to authenticated;

comment on function public.admin_historical_business_snapshot() is
  'Admin-only, read-only business aggregates reconstructed from durable application rows. source=derived; never represents page views, clicks, sessions or raw telemetry.';
