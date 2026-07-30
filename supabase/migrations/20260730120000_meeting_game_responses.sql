-- Propozycje gier oddzielone od odpowiedzi graczy.
--
-- Do tej pory kandydat na wieczór istniał wyłącznie tak długo, jak długo miał
-- choć jeden głos — widok rankingowy był zwykłym group by po tabeli głosów.
-- Cofnięcie ostatniego głosu kasowało więc całą propozycję, również cudzą.
--
-- Nowy model rozdziela dwa byty:
--   * meeting_game_proposals  — gra zgłoszona na dany wieczór (trwała),
--   * meeting_game_responses  — decyzja gracza: chce grać / nie chce grać.
-- Brak wiersza odpowiedzi oznacza „jeszcze nie odpowiedział”.
--
-- Zapisy wyłącznie przez transakcyjne RPC: authenticated dostaje na obu
-- tabelach sam select, tak jak przy point_events i user_achievements.

-- 1. Zmiana nazwy tabeli głosów wraz z danymi ------------------------------

alter table public.meeting_game_votes rename to meeting_game_responses;

alter index meeting_game_votes_meeting_game_idx
  rename to meeting_game_responses_meeting_game_idx;

alter table public.meeting_game_responses
  rename constraint meeting_game_votes_pkey to meeting_game_responses_pkey;

alter table public.meeting_game_responses
  rename constraint meeting_game_votes_meeting_id_fkey
  to meeting_game_responses_meeting_id_fkey;

alter table public.meeting_game_responses
  rename constraint meeting_game_votes_game_id_fkey
  to meeting_game_responses_game_id_fkey;

alter table public.meeting_game_responses
  rename constraint meeting_game_votes_user_id_fkey
  to meeting_game_responses_user_id_fkey;

-- Istniejące głosy to odpowiedzi twierdzące; default służy wyłącznie do
-- backfillu i zaraz go zdejmujemy, żeby brak wartości był błędem.
alter table public.meeting_game_responses
  add column wants_to_play boolean not null default true;

alter table public.meeting_game_responses
  alter column wants_to_play drop default;

-- 2. Tabela propozycji ------------------------------------------------------

create table public.meeting_game_proposals (
  meeting_id uuid not null
    references public.meetings (id) on delete cascade,
  game_id uuid not null
    references public.games (id) on delete cascade,
  proposed_by uuid not null
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint meeting_game_proposals_pkey primary key (meeting_id, game_id)
);

alter table public.meeting_game_proposals enable row level security;

create index meeting_game_proposals_meeting_idx
  on public.meeting_game_proposals (meeting_id);

-- Backfill: autorem propozycji zostaje najwcześniej odpowiadający gracz.
insert into public.meeting_game_proposals (
  meeting_id,
  game_id,
  proposed_by,
  created_at
)
select distinct on (response.meeting_id, response.game_id)
  response.meeting_id,
  response.game_id,
  response.user_id,
  response.created_at
from public.meeting_game_responses as response
order by response.meeting_id, response.game_id, response.created_at asc;

-- 3. Odpowiedź nie może istnieć bez propozycji ------------------------------

alter table public.meeting_game_responses
  add constraint meeting_game_responses_proposal_fkey
  foreign key (meeting_id, game_id)
  references public.meeting_game_proposals (meeting_id, game_id)
  on delete cascade;

-- 4. Widok rankingowy -------------------------------------------------------
--
-- Kandydat pochodzi teraz z propozycji, więc left join utrzymuje go na liście
-- także przy zerowej liczbie odpowiedzi. count(user_id) zamiast count(*),
-- bo przy braku dopasowania w left join count(*) policzyłby wiersz z samymi
-- nullami.

drop view if exists public.meeting_game_rankings;

create view public.meeting_game_rankings
with (security_invoker = true)
as
select
  proposal.meeting_id,
  proposal.game_id,
  count(response.user_id) filter (
    where response.wants_to_play is true
  )::bigint as yes_count,
  count(response.user_id) filter (
    where response.wants_to_play is false
  )::bigint as no_count
from public.meeting_game_proposals as proposal
left join public.meeting_game_responses as response
  on response.meeting_id = proposal.meeting_id
  and response.game_id = proposal.game_id
group by proposal.meeting_id, proposal.game_id;

revoke all on public.meeting_game_rankings from public, anon;
grant select on public.meeting_game_rankings to authenticated;
grant select on public.meeting_game_rankings to service_role;

-- 5. Polityki RLS -----------------------------------------------------------
--
-- Zapisy idą wyłącznie przez security definer RPC, więc polityki zapisu na
-- tabeli odpowiedzi znikają — bez grantów byłyby i tak martwe, a ich obecność
-- sugerowałaby, że klient może pisać wprost.

drop policy if exists meeting_game_votes_select_members
  on public.meeting_game_responses;
drop policy if exists meeting_game_votes_insert_own
  on public.meeting_game_responses;
drop policy if exists meeting_game_votes_delete_own
  on public.meeting_game_responses;

create policy meeting_game_responses_select_members
on public.meeting_game_responses for select to authenticated
using (
  private.is_active_member()
  and exists (
    select 1
    from public.meetings as parent
    where parent.id = meeting_game_responses.meeting_id
      and parent.deleted_at is null
  )
);

create policy meeting_game_proposals_select_members
on public.meeting_game_proposals for select to authenticated
using (
  private.is_active_member()
  and exists (
    select 1
    from public.meetings as parent
    where parent.id = meeting_game_proposals.meeting_id
      and parent.deleted_at is null
  )
);

-- 6. Granty tabelowe --------------------------------------------------------

revoke insert, update, delete on public.meeting_game_responses
  from authenticated;
grant select on public.meeting_game_responses to authenticated;

revoke all on public.meeting_game_proposals from public, anon;
grant select on public.meeting_game_proposals to authenticated;
grant select, insert, update, delete on public.meeting_game_proposals
  to service_role;
grant select, insert, update, delete on public.meeting_game_responses
  to service_role;

-- 7. Punkty za udział w głosowaniu -----------------------------------------
--
-- Odpowiedź odmowna liczy się tak samo jak twierdząca — punktowany jest sam
-- udział. Jednokrotność zapewnia point_events_once_per_related_idx na
-- (user_id, action_type, related_entity_type, related_entity_id), czyli przy
-- ('meeting', meeting_id) dokładnie raz na gracza i spotkanie.
--
-- action_type zostaje 'meeting_vote': jest zapisany w historycznych wierszach
-- point_events oraz na liście odwracania w public.delete_meeting.

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

-- Helper wołany wyłącznie wewnątrz transakcyjnych RPC poniżej.
revoke all on function public.award_meeting_vote_points(uuid)
from public, anon, authenticated;

-- 8. Wspólny strażnik dostępu do spotkania ----------------------------------

create or replace function private.assert_meeting_writable(p_meeting_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.current_user_can_write() then
    raise exception 'Active membership with write access is required'
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
end;
$$;

revoke all on function private.assert_meeting_writable(uuid)
from public, anon, authenticated;

-- 9. RPC: zgłoszenie gry na wieczór -----------------------------------------
--
-- Atomowo: propozycja + twierdząca odpowiedź autora + punkty za udział.
-- Duplikat tej samej gry dla tego samego spotkania odbija primary key.

create or replace function public.propose_meeting_game(
  p_meeting_id uuid,
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
  perform private.assert_meeting_writable(p_meeting_id);

  if p_game_id is null or not exists (
    select 1
    from public.games
    where id = p_game_id
      and archived_at is null
  ) then
    raise exception 'Game does not exist or is archived'
      using errcode = '23503';
  end if;

  insert into public.meeting_game_proposals (
    meeting_id,
    game_id,
    proposed_by
  )
  values (p_meeting_id, p_game_id, current_user_id)
  on conflict (meeting_id, game_id) do nothing;

  insert into public.meeting_game_responses (
    meeting_id,
    game_id,
    user_id,
    wants_to_play
  )
  values (p_meeting_id, p_game_id, current_user_id, true)
  on conflict (meeting_id, game_id, user_id)
  do update set wants_to_play = true;

  return query
  select *
  from public.award_meeting_vote_points(p_meeting_id);
end;
$$;

revoke all on function public.propose_meeting_game(uuid, uuid)
from public, anon;
grant execute on function public.propose_meeting_game(uuid, uuid)
to authenticated;

-- 10. RPC: decyzja gracza ---------------------------------------------------
--
-- Odpowiedź zawsze zapisywana dla auth.uid(), więc zapis za inną osobę jest
-- niemożliwy z definicji sygnatury. Zmiana decyzji nigdy nie usuwa propozycji
-- ani nie odbiera przyznanych punktów.

create or replace function public.set_meeting_game_response(
  p_meeting_id uuid,
  p_game_id uuid,
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
    from public.meeting_game_proposals
    where meeting_id = p_meeting_id
      and game_id = p_game_id
  ) then
    raise exception 'Game is not a candidate for this meeting'
      using errcode = '23503';
  end if;

  insert into public.meeting_game_responses (
    meeting_id,
    game_id,
    user_id,
    wants_to_play
  )
  values (p_meeting_id, p_game_id, current_user_id, p_wants_to_play)
  on conflict (meeting_id, game_id, user_id)
  do update set wants_to_play = excluded.wants_to_play;

  return query
  select *
  from public.award_meeting_vote_points(p_meeting_id);
end;
$$;

revoke all on function public.set_meeting_game_response(uuid, uuid, boolean)
from public, anon;
grant execute on function public.set_meeting_game_response(uuid, uuid, boolean)
to authenticated;
