-- Tryb kooperacyjny partii (M7 z planu „tryb kooperacyjny + przeliczanie
-- nagród”).
--
-- Do tej pory Kronika modelowała wyłącznie rywalizację: uczestnik miał miejsce
-- i znacznik zwycięzcy. Gry kooperacyjne zapisywano obejściem (wszyscy
-- 1/1/1), a PORAŻKI KOOPERACYJNEJ nie dało się zapisać w ogóle, bo walidacja
-- wymagała co najmniej jednego zwycięzcy dla partii ukończonej.
--
-- Model docelowy:
--   * competitive — bez zmian: miejsca po stronie użytkownika, team_result NULL,
--   * cooperative — wynik należy do DRUŻYNY (win/loss), miejsc nie ma wcale,
--     a is_winner jest techniczną pochodną team_result, jednakową dla
--     wszystkich uczestników.

create type public.play_mode as enum ('competitive', 'cooperative');
create type public.play_team_result as enum ('win', 'loss');

alter table public.plays
  add column mode public.play_mode not null default 'competitive',
  add column team_result public.play_team_result;

comment on column public.plays.mode is
  'Tryb partii. Domyślnie competitive, dzięki czemu wszystkie wpisy sprzed wdrożenia zachowują dotychczasowe znaczenie bez zgadywania, które z nich były kooperacyjne.';

-- Wynik drużyny istnieje wyłącznie w trybie kooperacyjnym i wyłącznie dla
-- partii ukończonej. Partia „w toku” nie ma jeszcze rozstrzygnięcia.
alter table public.plays
  add constraint plays_team_result_matches_mode check (
    (mode = 'competitive' and team_result is null)
    or (mode = 'cooperative' and (status <> 'completed' or team_result is not null))
  );

alter table public.plays
  add constraint plays_incomplete_has_no_team_result check (
    status = 'completed' or team_result is null
  );

-- ---------------------------------------------------------------------------
-- Walidacja ładunku zależna od trybu
-- ---------------------------------------------------------------------------

-- Niezmienniki, których nie da się wyrazić CHECK-iem (dotyczą relacji między
-- plays a play_participants):
--
--  | sytuacja                  | team_result | placement | is_winner              |
--  |---------------------------|-------------|-----------|------------------------|
--  | competitive + completed   | NULL        | dowolne   | >= 1 zwycięzca         |
--  | cooperative + completed   | wymagany    | NULL      | = (team_result='win')  |
--  | cooperative + in_progress | NULL        | NULL      | false                  |
--  | competitive + in_progress | NULL        | dowolne   | bez wymogu             |

drop function if exists private.assert_valid_play_payload(
  integer, jsonb, public.play_status
);

create function private.assert_valid_play_payload(
  p_duration_minutes integer,
  p_participants jsonb,
  p_status public.play_status default 'completed',
  p_mode public.play_mode default 'competitive',
  p_team_result public.play_team_result default null
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  participant_count integer;
  winners_count integer;
  placed_count integer;
  expected_winner boolean;
begin
  if p_duration_minutes is not null and p_duration_minutes <= 0 then
    raise exception 'Duration must be a positive number of minutes'
      using errcode = '23514';
  end if;

  select
    count(*),
    count(*) filter (where coalesce(participant.is_winner, false)),
    count(*) filter (where participant.placement is not null)
  into participant_count, winners_count, placed_count
  from jsonb_to_recordset(coalesce(p_participants, '[]'::jsonb)) as participant(
    user_id uuid,
    placement smallint,
    score numeric(12, 2),
    is_winner boolean
  );

  if participant_count = 0 then
    raise exception 'At least one participant is required'
      using errcode = '23514';
  end if;

  if p_mode = 'competitive' then
    if p_team_result is not null then
      raise exception 'Competitive play cannot carry a team result'
        using errcode = '23514';
    end if;

    -- Reguła sprzed wdrożenia, nienaruszona.
    if p_status = 'completed' and winners_count = 0 then
      raise exception 'At least one winner is required for a completed play'
        using errcode = '23514';
    end if;

    return;
  end if;

  -- === cooperative =========================================================

  -- Miejsca nie istnieją w kooperacji — ani w partii ukończonej, ani w toku.
  if placed_count > 0 then
    raise exception 'Cooperative play cannot store participant placements'
      using errcode = '23514';
  end if;

  if p_status <> 'completed' then
    if p_team_result is not null then
      raise exception 'Unfinished cooperative play cannot carry a team result'
        using errcode = '23514';
    end if;

    if winners_count > 0 then
      raise exception 'Unfinished cooperative play cannot mark winners'
        using errcode = '23514';
    end if;

    return;
  end if;

  if p_team_result is null then
    raise exception 'Cooperative play requires a team result'
      using errcode = '23514';
  end if;

  -- is_winner jest pochodną wyniku drużyny: wszyscy wygrywają albo wszyscy
  -- przegrywają. Nie ma indywidualnego zwycięzcy ani pokonanych.
  expected_winner := p_team_result = 'win';

  if expected_winner and winners_count <> participant_count then
    raise exception 'Cooperative win requires every participant to be marked as winner'
      using errcode = '23514';
  end if;

  if not expected_winner and winners_count <> 0 then
    raise exception 'Cooperative loss cannot mark any participant as winner'
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function private.assert_valid_play_payload(
  integer, jsonb, public.play_status, public.play_mode, public.play_team_result
) from public, anon, authenticated;

grant execute on function private.assert_valid_play_payload(
  integer, jsonb, public.play_status, public.play_mode, public.play_team_result
) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC z trybem i wynikiem drużyny
-- ---------------------------------------------------------------------------

-- Stare sygnatury muszą zniknąć, żeby nie została cicha wersja przeciążona,
-- którą dałoby się wywołać z pominięciem nowych reguł.
drop function if exists public.create_play_with_participants(
  uuid, timestamptz, uuid, integer, text, jsonb, public.play_status, text
);
drop function if exists public.update_play_with_participants(
  uuid, uuid, timestamptz, uuid, integer, text, jsonb, public.play_status, text
);

create function public.create_play_with_participants(
  p_game_id uuid,
  p_played_at timestamptz,
  p_meeting_id uuid default null,
  p_duration_minutes integer default null,
  p_comment text default null,
  p_participants jsonb default '[]'::jsonb,
  p_status public.play_status default 'completed',
  p_state_note text default null,
  p_mode public.play_mode default 'competitive',
  p_team_result public.play_team_result default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_play_id uuid;
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'Authenticated user required'
      using errcode = '42501';
  end if;

  if not private.current_user_can_write() then
    raise exception 'Play management permission is required'
      using errcode = '42501';
  end if;

  perform private.assert_valid_play_payload(
    p_duration_minutes,
    p_participants,
    p_status,
    p_mode,
    p_team_result
  );

  insert into public.plays (
    game_id, meeting_id, created_by, played_at, duration_minutes,
    comment, status, state_note, mode, team_result, rewards_managed
  )
  values (
    p_game_id, p_meeting_id, actor_id, p_played_at, p_duration_minutes,
    p_comment, p_status, p_state_note, p_mode, p_team_result, true
  )
  returning id into created_play_id;

  insert into public.play_participants (
    play_id, user_id, placement, score, is_winner
  )
  select
    created_play_id,
    participant.user_id,
    participant.placement,
    participant.score,
    coalesce(participant.is_winner, false)
  from jsonb_to_recordset(coalesce(p_participants, '[]'::jsonb)) as participant(
    user_id uuid,
    placement smallint,
    score numeric(12, 2),
    is_winner boolean
  );

  perform private.recompute_play_rewards(
    private.play_reward_stakeholders(created_play_id),
    created_play_id,
    'Zapis partii w Kronice'
  );

  return created_play_id;
end;
$$;

create function public.update_play_with_participants(
  p_play_id uuid,
  p_game_id uuid,
  p_played_at timestamptz,
  p_meeting_id uuid default null,
  p_duration_minutes integer default null,
  p_comment text default null,
  p_participants jsonb default '[]'::jsonb,
  p_status public.play_status default 'completed',
  p_state_note text default null,
  p_mode public.play_mode default 'competitive',
  p_team_result public.play_team_result default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_play_id uuid;
  actor_id uuid := auth.uid();
  stakeholders_before uuid[];
  stakeholders_after uuid[];
begin
  if actor_id is null then
    raise exception 'Authenticated user required'
      using errcode = '42501';
  end if;

  perform private.assert_valid_play_payload(
    p_duration_minutes,
    p_participants,
    p_status,
    p_mode,
    p_team_result
  );

  if not exists (
    select 1
    from public.plays as play
    where play.id = p_play_id
      and private.current_user_can_write()
      and (private.is_admin() or play.created_by = actor_id)
  ) then
    raise exception 'Play not found or not accessible'
      using errcode = '42501';
  end if;

  stakeholders_before := private.play_reward_stakeholders(p_play_id);

  -- Zmiana trybu nie wymaga tu żadnego czyszczenia miejsc: zestaw uczestników
  -- jest i tak kasowany oraz wstawiany od nowa, a walidator wymusił już, że
  -- ładunek kooperacyjny nie zawiera miejsc ani niespójnych zwycięzców.
  update public.plays
  set
    game_id = p_game_id,
    meeting_id = p_meeting_id,
    played_at = p_played_at,
    duration_minutes = p_duration_minutes,
    comment = p_comment,
    status = p_status,
    state_note = p_state_note,
    mode = p_mode,
    team_result = p_team_result
  where id = p_play_id
  returning id into updated_play_id;

  if updated_play_id is null then
    raise exception 'Play not found or not accessible'
      using errcode = '42501';
  end if;

  delete from public.play_participants
  where play_id = p_play_id;

  insert into public.play_participants (
    play_id, user_id, placement, score, is_winner
  )
  select
    p_play_id,
    participant.user_id,
    participant.placement,
    participant.score,
    coalesce(participant.is_winner, false)
  from jsonb_to_recordset(coalesce(p_participants, '[]'::jsonb)) as participant(
    user_id uuid,
    placement smallint,
    score numeric(12, 2),
    is_winner boolean
  );

  stakeholders_after := private.play_reward_stakeholders(p_play_id);

  perform private.recompute_play_rewards(
    stakeholders_before || stakeholders_after,
    p_play_id,
    'Edycja partii w Kronice'
  );

  return updated_play_id;
end;
$$;

revoke all on function public.create_play_with_participants(
  uuid, timestamptz, uuid, integer, text, jsonb, public.play_status, text,
  public.play_mode, public.play_team_result
) from public, anon, authenticated;

revoke all on function public.update_play_with_participants(
  uuid, uuid, timestamptz, uuid, integer, text, jsonb, public.play_status, text,
  public.play_mode, public.play_team_result
) from public, anon, authenticated;

grant execute on function public.create_play_with_participants(
  uuid, timestamptz, uuid, integer, text, jsonb, public.play_status, text,
  public.play_mode, public.play_team_result
) to authenticated;

grant execute on function public.update_play_with_participants(
  uuid, uuid, timestamptz, uuid, integer, text, jsonb, public.play_status, text,
  public.play_mode, public.play_team_result
) to authenticated;
