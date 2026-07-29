-- Wpięcie przeliczania nagród w mutacje partii (M6 z planu „tryb kooperacyjny
-- + przeliczanie nagród”).
--
-- Trzy zmiany:
--   1. RPC partii przechodzą z SECURITY INVOKER na SECURITY DEFINER,
--   2. każda mutacja kończy się przeliczeniem nagród dotkniętych użytkowników,
--   3. usuwanie partii dostaje własne RPC — dotąd było gołym DELETE z warstwy
--      TS, przez co nie miało jak niczego przeliczyć.
--
-- DLACZEGO SECURITY DEFINER. private.recompute_play_rewards celowo nie ma
-- EXECUTE dla roli authenticated (nikt spoza silnika nie może uruchomić
-- przeliczania). Funkcja SECURITY INVOKER wykonuje się z uprawnieniami
-- wołającego, więc nie mogłaby jej wywołać. Skoro RLS przestaje być tu
-- strażnikiem, autoryzacja jest odwzorowana JAWNIE i odpowiada dokładnie
-- politykom plays_insert_creator / plays_update_creator_or_admin /
-- plays_delete_creator_or_admin z 20260708000200. Pilnują tego testy pgTAP
-- 63-72 oraz 264, które pozostają bez zmian.

-- ---------------------------------------------------------------------------
-- 1. Pomocnik: zbiór użytkowników dotkniętych zmianą partii
-- ---------------------------------------------------------------------------

-- Uczestnicy partii, jej autor oraz gospodarz powiązanego spotkania (przez
-- camp_host). Wołane PRZED i PO mutacji — suma obu wyników pokrywa zarówno
-- graczy usuniętych z partii, jak i dopisanych.
create or replace function private.play_reward_stakeholders(p_play_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct stakeholder.user_id), array[]::uuid[])
  from (
    select participant.user_id
    from public.play_participants as participant
    where participant.play_id = p_play_id

    union

    select play.created_by
    from public.plays as play
    where play.id = p_play_id

    union

    select meeting.created_by
    from public.plays as play
    join public.meetings as meeting on meeting.id = play.meeting_id
    where play.id = p_play_id
  ) as stakeholder(user_id)
  where stakeholder.user_id is not null;
$$;

revoke all on function private.play_reward_stakeholders(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tworzenie partii
-- ---------------------------------------------------------------------------

create or replace function public.create_play_with_participants(
  p_game_id uuid,
  p_played_at timestamptz,
  p_meeting_id uuid default null,
  p_duration_minutes integer default null,
  p_comment text default null,
  p_participants jsonb default '[]'::jsonb,
  p_status public.play_status default 'completed',
  p_state_note text default null
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

  -- Odpowiednik polityki plays_insert_creator.
  if not private.current_user_can_write() then
    raise exception 'Play management permission is required'
      using errcode = '42501';
  end if;

  perform private.assert_valid_play_payload(
    p_duration_minutes,
    p_participants,
    p_status
  );

  insert into public.plays (
    game_id,
    meeting_id,
    created_by,
    played_at,
    duration_minutes,
    comment,
    status,
    state_note,
    rewards_managed
  )
  values (
    p_game_id,
    p_meeting_id,
    actor_id,
    p_played_at,
    p_duration_minutes,
    p_comment,
    p_status,
    p_state_note,
    -- Partia „urodzona” w nowym systemie: od tej chwili jej punkty za zapis
    -- podlegają przeliczaniu. Partie sprzed wdrożenia mają false i pozostają
    -- legacy-untracked.
    true
  )
  returning id into created_play_id;

  insert into public.play_participants (
    play_id,
    user_id,
    placement,
    score,
    is_winner
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

-- ---------------------------------------------------------------------------
-- 3. Edycja partii
-- ---------------------------------------------------------------------------

create or replace function public.update_play_with_participants(
  p_play_id uuid,
  p_game_id uuid,
  p_played_at timestamptz,
  p_meeting_id uuid default null,
  p_duration_minutes integer default null,
  p_comment text default null,
  p_participants jsonb default '[]'::jsonb,
  p_status public.play_status default 'completed',
  p_state_note text default null
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
    p_status
  );

  -- Odpowiednik polityki plays_update_creator_or_admin. Sprawdzane PRZED
  -- jakąkolwiek modyfikacją, więc odrzucona próba nie rusza uczestników
  -- (pgTAP 70).
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

  -- Zdjęcie stanu przed zmianą: gracze usunięci z partii i gospodarz starego
  -- spotkania też muszą zostać przeliczeni.
  stakeholders_before := private.play_reward_stakeholders(p_play_id);

  update public.plays
  set
    game_id = p_game_id,
    meeting_id = p_meeting_id,
    played_at = p_played_at,
    duration_minutes = p_duration_minutes,
    comment = p_comment,
    status = p_status,
    state_note = p_state_note
  where id = p_play_id
  returning id into updated_play_id;

  if updated_play_id is null then
    raise exception 'Play not found or not accessible'
      using errcode = '42501';
  end if;

  delete from public.play_participants
  where play_id = p_play_id;

  insert into public.play_participants (
    play_id,
    user_id,
    placement,
    score,
    is_winner
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

-- ---------------------------------------------------------------------------
-- 4. Usuwanie partii
-- ---------------------------------------------------------------------------

-- Nowe RPC. Do tej pory warstwa TS kasowała wiersz bezpośrednio
-- (`from("plays").delete()`), przez co skutki nagrodowe usuniętej partii
-- zostawały w systemie na zawsze. Usunięcie musi być transakcyjne razem z
-- przeliczeniem, więc nie da się tego zrobić po stronie klienta.
--
-- Pliki zdjęć w Storage nadal usuwa warstwa TS PRZED wywołaniem tego RPC —
-- baza nie ma dostępu do bucketa.
create or replace function public.delete_play(p_play_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  stakeholders uuid[];
  deleted_play_id uuid;
begin
  if actor_id is null then
    raise exception 'Authenticated user required'
      using errcode = '42501';
  end if;

  -- Odpowiednik polityki plays_delete_creator_or_admin.
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

  -- Musi zostać zdjęte przed DELETE — po kaskadzie nie ma już uczestników.
  stakeholders := private.play_reward_stakeholders(p_play_id);

  delete from public.plays
  where id = p_play_id
  returning id into deleted_play_id;

  if deleted_play_id is null then
    raise exception 'Play not found or not accessible'
      using errcode = '42501';
  end if;

  -- p_play_id przekazujemy jako null: partia już nie istnieje, a kolumny
  -- last_play_id / triggered_by_play_id mają klucz obcy do plays.
  perform private.recompute_play_rewards(
    stakeholders,
    null,
    'Usunięcie partii z Kroniki'
  );

  return p_play_id;
end;
$$;

revoke all on function public.delete_play(uuid) from public, anon, authenticated;
grant execute on function public.delete_play(uuid) to authenticated;
