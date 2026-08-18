-- Propozycja dokończenia konkretnej partii jest innym celem głosowania niż
-- propozycja gry. Osobne tabele zachowują bez zmian istniejący model
-- meeting_game_* i pozwalają odróżnić kilka rozpoczętych partii tej samej gry.

create table public.meeting_continuation_proposals (
  meeting_id uuid not null
    references public.meetings (id) on delete cascade,
  continued_play_id uuid not null
    references public.plays (id) on delete cascade,
  proposed_by uuid not null
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meeting_id, continued_play_id)
);

create table public.meeting_continuation_responses (
  meeting_id uuid not null,
  continued_play_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  wants_to_play boolean not null,
  created_at timestamptz not null default now(),
  primary key (meeting_id, continued_play_id, user_id),
  foreign key (meeting_id, continued_play_id)
    references public.meeting_continuation_proposals (
      meeting_id,
      continued_play_id
    )
    on delete cascade
);

create index meeting_continuation_proposals_meeting_idx
  on public.meeting_continuation_proposals (meeting_id);

create index meeting_continuation_responses_meeting_play_idx
  on public.meeting_continuation_responses (meeting_id, continued_play_id);

alter table public.meeting_continuation_proposals enable row level security;
alter table public.meeting_continuation_responses enable row level security;

create policy meeting_continuation_proposals_select_members
on public.meeting_continuation_proposals for select to authenticated
using (
  private.is_active_member()
  and exists (
    select 1
    from public.meetings as meeting
    where meeting.id = meeting_continuation_proposals.meeting_id
      and meeting.deleted_at is null
  )
);

create policy meeting_continuation_responses_select_members
on public.meeting_continuation_responses for select to authenticated
using (
  private.is_active_member()
  and exists (
    select 1
    from public.meetings as meeting
    where meeting.id = meeting_continuation_responses.meeting_id
      and meeting.deleted_at is null
  )
);

revoke all on public.meeting_continuation_proposals from public, anon;
revoke all on public.meeting_continuation_responses from public, anon;
revoke insert, update, delete on public.meeting_continuation_proposals
  from authenticated;
revoke insert, update, delete on public.meeting_continuation_responses
  from authenticated;
grant select on public.meeting_continuation_proposals to authenticated;
grant select on public.meeting_continuation_responses to authenticated;
grant select, insert, update, delete on public.meeting_continuation_proposals
  to service_role;
grant select, insert, update, delete on public.meeting_continuation_responses
  to service_role;

create view public.meeting_continuation_rankings
with (security_invoker = true)
as
select
  proposal.meeting_id,
  proposal.continued_play_id,
  count(response.user_id) filter (
    where response.wants_to_play is true
  )::bigint as yes_count,
  count(response.user_id) filter (
    where response.wants_to_play is false
  )::bigint as no_count
from public.meeting_continuation_proposals as proposal
left join public.meeting_continuation_responses as response
  on response.meeting_id = proposal.meeting_id
  and response.continued_play_id = proposal.continued_play_id
group by proposal.meeting_id, proposal.continued_play_id;

revoke all on public.meeting_continuation_rankings from public, anon;
grant select on public.meeting_continuation_rankings to authenticated;
grant select on public.meeting_continuation_rankings to service_role;

-- Odpowiedź na kontynuację jest takim samym udziałem w ankiecie spotkania jak
-- odpowiedź na zwykłą grę. Idempotencja meeting_vote nadal jest raz na gracza
-- i spotkanie, niezależnie od liczby propozycji.
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

create or replace function public.propose_meeting_continuation(
  p_meeting_id uuid,
  p_continued_play_id uuid
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
  perform private.assert_meeting_writable(p_meeting_id);

  if p_continued_play_id is null
    or not private.is_continuable_play(p_continued_play_id) then
    raise exception 'Play cannot be proposed as a continuation'
      using errcode = '23514';
  end if;

  perform private.assert_valid_continued_play(
    p_meeting_id,
    p_continued_play_id
  );

  insert into public.meeting_continuation_proposals (
    meeting_id,
    continued_play_id,
    proposed_by
  )
  values (p_meeting_id, p_continued_play_id, current_user_id)
  on conflict (meeting_id, continued_play_id) do nothing;

  insert into public.meeting_continuation_responses (
    meeting_id,
    continued_play_id,
    user_id,
    wants_to_play
  )
  values (p_meeting_id, p_continued_play_id, current_user_id, true)
  on conflict (meeting_id, continued_play_id, user_id)
  do update set wants_to_play = true;

  return query
  select *
  from public.award_meeting_vote_points(p_meeting_id);
end;
$$;

revoke all on function public.propose_meeting_continuation(uuid, uuid)
from public, anon;
grant execute on function public.propose_meeting_continuation(uuid, uuid)
to authenticated;

create or replace function public.set_meeting_continuation_response(
  p_meeting_id uuid,
  p_continued_play_id uuid,
  p_wants_to_play boolean
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
  perform private.assert_meeting_writable(p_meeting_id);

  if p_wants_to_play is null then
    raise exception 'Response value is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.meeting_continuation_proposals
    where meeting_id = p_meeting_id
      and continued_play_id = p_continued_play_id
  ) then
    raise exception 'Continuation is not a candidate for this meeting'
      using errcode = '23503';
  end if;

  if not private.is_continuable_play(p_continued_play_id) then
    raise exception 'Play cannot be proposed as a continuation'
      using errcode = '23514';
  end if;

  insert into public.meeting_continuation_responses (
    meeting_id,
    continued_play_id,
    user_id,
    wants_to_play
  )
  values (
    p_meeting_id,
    p_continued_play_id,
    current_user_id,
    p_wants_to_play
  )
  on conflict (meeting_id, continued_play_id, user_id)
  do update set wants_to_play = excluded.wants_to_play;

  return query
  select *
  from public.award_meeting_vote_points(p_meeting_id);
end;
$$;

revoke all on function public.set_meeting_continuation_response(
  uuid,
  uuid,
  boolean
) from public, anon;
grant execute on function public.set_meeting_continuation_response(
  uuid,
  uuid,
  boolean
) to authenticated;
