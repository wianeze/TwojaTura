create view public.game_rating_summaries
with (security_invoker = true)
as
select
  game_id,
  round(avg(overall)::numeric, 2) as average_overall,
  round(avg(replayability)::numeric, 2) as average_replayability,
  round(avg(theme)::numeric, 2) as average_theme,
  count(*)::bigint as ratings_count,
  count(*) filter (where wants_to_play_again)::bigint as wants_to_play_again_count
from public.ratings
group by game_id;

create view public.meeting_option_summaries
with (security_invoker = true)
as
select
  options.id as meeting_option_id,
  options.meeting_id,
  options.starts_at,
  count(availability.user_id) filter (
    where availability.is_available = true
  )::bigint as available_count
from public.meeting_options as options
left join public.meeting_availability as availability
  on availability.meeting_option_id = options.id
group by options.id, options.meeting_id, options.starts_at;

create view public.meeting_game_rankings
with (security_invoker = true)
as
select
  meeting_id,
  game_id,
  count(*)::bigint as votes_count
from public.meeting_game_votes
group by meeting_id, game_id;

create view public.user_point_balances
with (security_invoker = true)
as
select
  membership.user_id,
  coalesce(sum(events.points), 0)::bigint as total_points
from public.app_members as membership
left join public.point_events as events
  on events.user_id = membership.user_id
where membership.is_active = true
  and (
    membership.user_id = auth.uid()
    or private.is_admin()
  )
group by membership.user_id;

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

revoke all on all tables in schema public from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.app_members to authenticated;
grant select, insert, update, delete on public.app_content to authenticated;
grant select, insert, update on public.games to authenticated;
grant select, insert, update, delete on public.ratings to authenticated;
grant select, insert, update, delete on public.meetings to authenticated;
grant select, insert, update, delete on public.meeting_options to authenticated;
grant select, insert, update, delete on public.meeting_availability to authenticated;
grant select, insert, delete on public.meeting_game_votes to authenticated;
grant select, insert, update, delete on public.plays to authenticated;
grant select, insert, update, delete on public.play_participants to authenticated;
grant select, insert on public.point_events to authenticated;
grant select on public.audit_log to authenticated;

grant select on public.game_rating_summaries to authenticated;
grant select on public.meeting_option_summaries to authenticated;
grant select on public.meeting_game_rankings to authenticated;
grant select on public.user_point_balances to authenticated;

grant usage on schema private to authenticated;
grant execute on function private.is_active_member(uuid) to authenticated;
grant execute on function private.is_admin(uuid) to authenticated;

revoke all on function public.get_leaderboard() from public, anon, authenticated;
grant execute on function public.get_leaderboard() to authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
