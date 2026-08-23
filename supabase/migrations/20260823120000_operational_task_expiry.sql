-- Zlecenia operacyjne — deadline nagrody niezależny od dostępności akcji.
--
-- UI ukrywa kartę po expiresAt, ale źródłem prawdy dla Renomy pozostaje baza:
--   * RSVP i odpowiedź w głosowaniu: do startu spotkania,
--   * ocena: do 7 dni po ukończonej partii użytkownika,
--   * nowy wpis Kroniki: utworzony do 72h po ends_at,
--   * wynik istniejącej partii: rozliczony do 7 dni po ends_at,
--     w obu przypadkach z fallbackiem do starts_at.
--
-- Po terminie funkcja domenowa nadal działa. RPC nagrody zwraca po prostu
-- awarded=false, a zapis partii przechodzi bez dodatniego point_event.

create or replace function private.meeting_task_reward_is_open(
  p_meeting_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.meetings as meeting
    where meeting.id = p_meeting_id
      and meeting.deleted_at is null
      and meeting.starts_at > statement_timestamp()
  );
$$;

revoke all on function private.meeting_task_reward_is_open(uuid)
from public, anon, authenticated;

create or replace function public.award_meeting_rsvp_points(
  p_meeting_id uuid
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
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  if p_meeting_id is null or not exists (
    select 1
    from public.meetings
    where id = p_meeting_id
      and deleted_at is null
  ) then
    raise exception 'Meeting does not exist'
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.meeting_availability
    where meeting_id = p_meeting_id
      and user_id = current_user_id
  ) then
    raise exception 'Saved RSVP is required before awarding points'
      using errcode = '22023';
  end if;

  if not private.meeting_task_reward_is_open(p_meeting_id) then
    return query select false, 0, null::uuid;
    return;
  end if;

  return query
  select *
  from private.award_points_once(
    current_user_id,
    'meeting_rsvp',
    'meeting',
    p_meeting_id,
    'Odpowiedź RSVP na spotkanie',
    current_user_id
  );
end;
$$;

revoke all on function public.award_meeting_rsvp_points(uuid)
from public, anon, authenticated;
grant execute on function public.award_meeting_rsvp_points(uuid)
to authenticated;

create or replace function public.award_meeting_vote_points(
  p_meeting_id uuid
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
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  if p_meeting_id is null or not exists (
    select 1
    from public.meetings
    where id = p_meeting_id
      and deleted_at is null
  ) then
    raise exception 'Meeting does not exist'
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.meeting_game_responses
    where meeting_id = p_meeting_id
      and user_id = current_user_id
  ) and not exists (
    select 1
    from public.meeting_continuation_responses
    where meeting_id = p_meeting_id
      and user_id = current_user_id
  ) then
    raise exception 'Saved game response is required before awarding points'
      using errcode = '22023';
  end if;

  if not private.meeting_task_reward_is_open(p_meeting_id) then
    return query select false, 0, null::uuid;
    return;
  end if;

  return query
  select *
  from private.award_points_once(
    current_user_id,
    'meeting_vote',
    'meeting',
    p_meeting_id,
    'Pierwsza odpowiedź w głosowaniu na grę',
    current_user_id
  );
end;
$$;

revoke all on function public.award_meeting_vote_points(uuid)
from public, anon, authenticated;
grant execute on function public.award_meeting_vote_points(uuid)
to authenticated;

create or replace function public.award_rating_created_points(
  p_game_id uuid
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
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  if p_game_id is null or not exists (
    select 1
    from public.games
    where id = p_game_id
  ) then
    raise exception 'Game does not exist'
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.ratings
    where game_id = p_game_id
      and user_id = current_user_id
  ) then
    raise exception 'Own rating is required before awarding points'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.plays as play
    join public.play_participants as participant
      on participant.play_id = play.id
    where play.game_id = p_game_id
      and play.status = 'completed'::public.play_status
      and participant.user_id = current_user_id
      and play.played_at <= statement_timestamp()
      and play.played_at > statement_timestamp() - interval '7 days'
  ) then
    return query select false, 0, null::uuid;
    return;
  end if;

  return query
  select *
  from private.award_points_once(
    current_user_id,
    'rating_created',
    'game',
    p_game_id,
    'Pierwsza ocena gry',
    current_user_id
  );
end;
$$;

revoke all on function public.award_rating_created_points(uuid)
from public, anon, authenticated;
grant execute on function public.award_rating_created_points(uuid)
to authenticated;

create or replace function private.play_participation_task_reward_is_timely(
  p_play_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.plays as play
    left join public.meetings as meeting on meeting.id = play.meeting_id
    where play.id = p_play_id
      and (
        (
          play.meeting_id is null
          and play.updated_at < play.played_at + interval '7 days'
        )
        or (
          meeting.id is not null
          and meeting.deleted_at is null
          -- Utworzenie wpisu jest Zleceniem 72h. Jeżeli wpis już istniał
          -- (np. result_pending), samo rozliczenie ma osobne 7 dni.
          and play.created_at <
            coalesce(meeting.ends_at, meeting.starts_at) + interval '72 hours'
          and play.updated_at <
            coalesce(meeting.ends_at, meeting.starts_at) + interval '7 days'
        )
      )
  );
$$;

revoke all on function private.play_participation_task_reward_is_timely(uuid)
from public, anon, authenticated;

-- Preview/rebase Economy V2 musi używać dokładnie tej samej bramki co zapis
-- partii. Bez tego podgląd obiecywałby +5 dla wpisu utworzonego po deadline,
-- podczas gdy silnik recompute poprawnie nie zapisałby nagrody.
alter function private.economy_v2_reward_plan()
rename to economy_v2_reward_plan_before_operational_task_expiry;

create or replace function private.economy_v2_reward_plan()
returns table (
  user_id uuid,
  reward_kind text,
  action_type text,
  entity_type text,
  entity_id uuid,
  target_points integer,
  current_points integer,
  delta integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select plan.*
  from private.economy_v2_reward_plan_before_operational_task_expiry() as plan
  where not (
    plan.reward_kind = 'play'
    and plan.target_points > 0
    and plan.current_points = 0
    and not private.play_participation_task_reward_is_timely(plan.entity_id)
    and not exists (
      select 1
      from public.play_reward_states as state
      where state.user_id = plan.user_id
        and state.reward_type = 'play_points'
        and state.reward_key = plan.entity_id::text
        and state.is_active
    )
  );
$$;

revoke all on function private.economy_v2_reward_plan()
from public, anon, authenticated;

revoke all on function private.economy_v2_reward_plan_before_operational_task_expiry()
from public, anon, authenticated;

alter function private.apply_reward_delta(
  uuid, public.reward_type, text, boolean, uuid, text
)
rename to apply_reward_delta_before_operational_task_expiry;

create or replace function private.apply_reward_delta(
  p_user_id uuid,
  p_reward_type public.reward_type,
  p_reward_key text,
  p_should_be_active boolean,
  p_play_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_reward_type = 'play_points'
     and p_should_be_active
     and not private.play_participation_task_reward_is_timely(
       p_reward_key::uuid
     )
     and not exists (
       select 1
       from public.play_reward_states as state
       where state.user_id = p_user_id
         and state.reward_type = 'play_points'
         and state.reward_key = p_reward_key
         and state.is_active
     )
     and private.reward_ledger_net(
       p_user_id,
       'play_points'::public.reward_type,
       p_reward_key
     ) = 0 then
    return false;
  end if;

  return private.apply_reward_delta_before_operational_task_expiry(
    p_user_id,
    p_reward_type,
    p_reward_key,
    p_should_be_active,
    p_play_id,
    p_reason
  );
end;
$$;

revoke all on function private.apply_reward_delta(
  uuid, public.reward_type, text, boolean, uuid, text
) from public, anon, authenticated;

revoke all on function private.apply_reward_delta_before_operational_task_expiry(
  uuid, public.reward_type, text, boolean, uuid, text
) from public, anon, authenticated;
