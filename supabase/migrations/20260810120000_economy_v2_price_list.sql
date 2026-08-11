-- Economy V2 — nowy cennik Renomy (krok 1/3).
--
-- Kontekst produktowy: Renoma przestaje być walutą operacyjną, a staje się
-- trwałym wynikiem prestiżowym. Czynności utrzymaniowe (odpowiedź na ankietę,
-- głos, ocena, zapis danych) dostają wartości symboliczne; realne skoki mają
-- pochodzić z odznak i milestone'ów.
--
-- Ta migracja zmienia WYŁĄCZNIE cennik i warunki przyznania. Nie dotyka ani
-- jednego historycznego wiersza public.point_events — przeliczenie historii
-- robi osobno migracja 20260810120200_economy_v2_rebase.sql.
--
-- Dwie zmiany semantyczne poza samymi liczbami:
--
--   1. `play_logged` ZNIKA z cennika i zostaje zastąpione przez
--      `play_participated` (krok 2/3 przestawia na nie silnik nagród).
--      Konsekwencja zamierzona: `point_reward_for` jest allow-listą dla
--      public.admin_award_point_event i public.admin_reverse_point_event, więc
--      po tej migracji admin nie może już ani przyznać, ani odwrócić starego
--      `play_logged = 40`. Historyczne zdarzenia zostają w księdze nietknięte
--      i czytelne; są tylko zamrożone dla korekt, bo rebase i tak sprowadza
--      ich wpływ ekonomiczny do zera i drugie odwrócenie odjęłoby je dwa razy.
--
--   2. `meeting_created` (25 Renomy za wypełnienie formularza) znika tak samo
--      jak `play_logged` i zostaje zastąpione przez `meeting_hosted` = 5.
--      Nowy typ, a nie nowa wartość starego: nagroda opisuje teraz co innego —
--      nie „utworzyłeś spotkanie”, tylko „Twoje spotkanie faktycznie się
--      odbyło”. Trzymanie tego pod dawną nazwą zostawiałoby w księdze wiersze,
--      których znaczenie zależy od daty zapisu, a tego nie da się później
--      odczytać bez znajomości historii migracji.
--
--      „Faktycznie się odbyło” = status 'completed' i deleted_at is null.
--      Jedyną ścieżką nadania tego statusu jest public.complete_meeting
--      (organizator albo admin, po rozliczeniu biegnących partii), więc to
--      tam wołamy naliczenie.

-- ---------------------------------------------------------------------------
-- 1. Cennik
-- ---------------------------------------------------------------------------

create or replace function private.point_reward_for(p_action_type text)
returns integer
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
begin
  case p_action_type
    -- Milestone'y Półki. Odwrócony kierunek względem V1: trudniejszy próg
    -- daje więcej, a nie mniej.
    when 'shelf_first_game' then return 10;
    when 'shelf_5_games' then return 15;
    when 'shelf_10_games' then return 20;
    when 'shelf_15_games' then return 25;
    -- Housekeeping organizacyjny — symbolicznie, żeby aplikacja nie była
    -- martwa między odznakami, ale bez wpływu na ranking.
    when 'meeting_rsvp' then return 2;
    when 'meeting_vote' then return 1;
    when 'rating_created' then return 3;
    -- Organizacja spotkania, które faktycznie się odbyło. Historyczne
    -- `meeting_created` celowo NIE figuruje w cenniku — nie da się go już ani
    -- przyznać, ani odwrócić przez panel korekt.
    when 'meeting_hosted' then return 5;
    -- Udział w ukończonej partii. Zastępuje `play_logged`, które płaciło
    -- wyłącznie osobie wprowadzającej dane.
    when 'play_participated' then return 5;
    else
      raise exception 'Unsupported point action type: %', p_action_type
        using errcode = '22023';
  end case;
end;
$$;

revoke all on function private.point_reward_for(text)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Nagroda za organizację — tylko za spotkanie, które się odbyło
-- ---------------------------------------------------------------------------

-- Zastępuje public.award_meeting_created_points z 20260705001800. Zmiany:
--   * inny typ zdarzenia: 'meeting_hosted' zamiast 'meeting_created',
--   * odbiorcą jest meetings.created_by, a nie auth.uid() — spotkanie może
--     domknąć admin, a Renoma i tak należy się organizatorowi,
--   * wymagany status 'completed' oraz deleted_at is null,
--   * brak spełnionego warunku nie jest błędem, tylko `awarded = false`.
create or replace function public.award_meeting_hosted_points(
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
  v_organizer_id uuid;
begin
  if current_user_id is null or not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  if p_meeting_id is null then
    raise exception 'Meeting does not exist'
      using errcode = '23503';
  end if;

  select meeting.created_by
  into v_organizer_id
  from public.meetings as meeting
  where meeting.id = p_meeting_id
    and meeting.deleted_at is null
    and meeting.status = 'completed'::public.meeting_status;

  -- Spotkanie nieodbyte, anulowane (usunięte) albo nieistniejące: 0 Renomy.
  if not found or not private.is_active_member(v_organizer_id) then
    return query select false, 0, null::uuid;
    return;
  end if;

  return query
  select *
  from private.award_points_once(
    v_organizer_id,
    'meeting_hosted',
    'meeting',
    p_meeting_id,
    'Zorganizowane spotkanie',
    v_organizer_id
  );
end;
$$;

revoke all on function public.award_meeting_hosted_points(uuid)
from public, anon, authenticated;

grant execute on function public.award_meeting_hosted_points(uuid)
to authenticated;

-- Stara funkcja przyznawała 25 Renomy za sam zapis formularza. Nie da się jej
-- już wykonać (jej action_type zniknął z cennika), więc usuwamy ją, żeby nie
-- została przypadkiem zawołana z nowego kodu.
drop function if exists public.award_meeting_created_points(uuid);

-- ---------------------------------------------------------------------------
-- 2b. Dwie listy typów spotkaniowych, które muszą znać nowy typ
-- ---------------------------------------------------------------------------

-- private.award_points_once (20260728120000) blokuje naliczanie punktów
-- spotkaniowych po miękkim usunięciu spotkania. Bez dopisania 'meeting_hosted'
-- do tej listy organizator mógłby dostać Renomę za wieczór, który został
-- usunięty. Reszta ciała jest przepisana bez zmian.
create or replace function private.award_points_once(
  p_user_id uuid,
  p_action_type text,
  p_related_entity_type text,
  p_related_entity_id uuid,
  p_description text default null,
  p_created_by uuid default auth.uid()
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
  awarded_points integer;
  inserted_event_id uuid;
  event_created_by uuid;
begin
  if p_user_id is null then
    raise exception 'Point recipient is required' using errcode = '22023';
  end if;

  if p_related_entity_type is null
    or length(btrim(p_related_entity_type)) = 0
    or p_related_entity_id is null then
    raise exception 'Related entity type and id are required'
      using errcode = '22023';
  end if;

  if not private.is_active_member(p_user_id) then
    raise exception 'Point recipient must be an active member'
      using errcode = '42501';
  end if;

  if private.is_admin(p_user_id) or private.is_observer(p_user_id) then
    return query select false, 0, null::uuid;
    return;
  end if;

  if btrim(p_related_entity_type) = 'meeting'
    and p_action_type in (
      'meeting_hosted', 'meeting_created', 'meeting_rsvp', 'meeting_vote'
    )
    and exists (
      select 1
      from public.meetings
      where id = p_related_entity_id
        and deleted_at is not null
    ) then
    raise exception 'Active meeting is required before awarding points'
      using errcode = '22023';
  end if;

  awarded_points := private.point_reward_for(p_action_type);
  event_created_by := coalesce(p_created_by, p_user_id);

  insert into public.point_events (
    user_id,
    points,
    action_type,
    description,
    related_entity_type,
    related_entity_id,
    created_by
  )
  values (
    p_user_id,
    awarded_points,
    p_action_type,
    p_description,
    btrim(p_related_entity_type),
    p_related_entity_id,
    event_created_by
  )
  on conflict do nothing
  returning id into inserted_event_id;

  return query
  select
    inserted_event_id is not null,
    awarded_points,
    inserted_event_id;
end;
$$;

revoke all on function private.award_points_once(uuid, text, text, uuid, text, uuid)
from public, anon, authenticated;

-- public.delete_meeting cofa punkty spotkaniowe przy miękkim usunięciu.
-- 'meeting_hosted' musi trafić na tę samą listę; 'meeting_created' zostaje na
-- niej dla wieczorów sprzed Economy V2, których jeszcze nikt nie usunął.
create or replace function public.delete_meeting(
  p_meeting_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  meeting_creator_id uuid;
  meeting_deleted_at timestamptz;
  meeting_continued_play_id uuid;
begin
  if current_user_id is null
    or not private.current_user_can_write() then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  select meeting.created_by, meeting.deleted_at, meeting.continued_play_id
  into meeting_creator_id, meeting_deleted_at, meeting_continued_play_id
  from public.meetings as meeting
  where meeting.id = p_meeting_id
  for update;

  if not found or meeting_deleted_at is not null then
    return false;
  end if;

  if meeting_creator_id <> current_user_id
    and not private.is_admin(current_user_id) then
    raise exception 'Only the meeting creator or an admin can delete this meeting'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.plays
    where meeting_id = p_meeting_id
  ) then
    raise exception 'To spotkanie jest częścią historii partii w Kronice. Najpierw usuń zapisaną na nim partię.'
      using errcode = 'P0001';
  end if;

  if meeting_continued_play_id is not null then
    raise exception 'To spotkanie jest częścią historii partii w Kronice. Najpierw usuń powiązanie z kontynuowaną partią w edycji spotkania.'
      using errcode = 'P0001';
  end if;

  update public.meetings
  set
    deleted_at = now(),
    deleted_by = current_user_id,
    deleted_reason = 'Usunięte przez użytkownika'
  where id = p_meeting_id;

  insert into public.point_events (
    user_id,
    points,
    action_type,
    description,
    related_entity_type,
    related_entity_id,
    created_by
  )
  select
    original.user_id,
    -original.points,
    'reversal:' || original.action_type,
    'Cofnięcie punktów za usunięte spotkanie',
    'meeting',
    p_meeting_id,
    current_user_id
  from public.point_events as original
  where original.related_entity_type = 'meeting'
    and original.related_entity_id = p_meeting_id
    and original.action_type in (
      'meeting_hosted',
      'meeting_created',
      'meeting_rsvp',
      'meeting_vote'
    )
    and original.points > 0
  on conflict do nothing;

  return true;
end;
$$;

revoke all on function public.delete_meeting(uuid)
from public, anon, authenticated;
grant execute on function public.delete_meeting(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Domknięcie spotkania nalicza Renomę organizatorowi
-- ---------------------------------------------------------------------------

-- Ciało skopiowane z 20260809150000 (uprawnienia, blokada biegnącej partii,
-- idempotentne wyjście przy already-completed). Jedyna zmiana to wywołanie
-- naliczenia po zapisaniu statusu — w tej samej transakcji, więc rollback
-- domknięcia cofa też Renomę.
create or replace function public.complete_meeting(
  p_meeting_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_created_by uuid;
  v_status public.meeting_status;
begin
  if actor_id is null or not private.current_user_can_write() then
    raise exception 'Active membership with write access is required'
      using errcode = '42501';
  end if;

  select meeting.created_by, meeting.status
  into v_created_by, v_status
  from public.meetings as meeting
  where meeting.id = p_meeting_id
    and meeting.deleted_at is null
  for update;

  if not found then
    raise exception 'Meeting does not exist'
      using errcode = '23503';
  end if;

  if not (private.is_admin(actor_id) or v_created_by = actor_id) then
    raise exception 'Only the organizer or an admin can finish this meeting'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.plays as play
    where play.status = 'in_progress'::public.play_status
      and play.live_started_at is not null
      and play.live_ended_at is null
      and (
        play.meeting_id = p_meeting_id
        or exists (
          select 1
          from public.meetings as continuation
          where continuation.id = p_meeting_id
            and continuation.continued_play_id = play.id
        )
      )
  ) then
    raise exception 'Finish the running play before closing the meeting'
      using errcode = '23514';
  end if;

  if v_status = 'completed'::public.meeting_status then
    return false;
  end if;

  update public.meetings
  set status = 'completed'::public.meeting_status
  where id = p_meeting_id;

  -- Idempotentne: award_points_once odbija się o point_events_once_per_
  -- related_revision_idx, więc ponowne domknięcie nie zdubluje Renomy.
  perform public.award_meeting_hosted_points(p_meeting_id);

  return true;
end;
$$;

revoke all on function public.complete_meeting(uuid)
from public, anon, authenticated;
grant execute on function public.complete_meeting(uuid) to authenticated;
