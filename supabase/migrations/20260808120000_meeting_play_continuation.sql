-- Kontynuacja rozpoczętej partii na kolejnym spotkaniu.
--
-- Problem: partia rozłożona na dwa wieczory nie miała jak powiązać drugiego
-- spotkania z rozpoczętym wpisem Kroniki. Jedyną dostępną drogą było
-- przepięcie plays.meeting_id z pierwszego spotkania na drugie — czyli
-- nadpisanie, po którym pierwsze spotkanie traciło swój wpis w Kronice
-- (hasChroniclePlay, quest "Uzupełnij wynik spotkania", zbiór spotkań
-- liczonych do camp_host). Drugą "naturalną" drogą było założenie osobnego
-- wpisu na sobotę, czyli dokładnie ten duplikat, którego model ma unikać.
--
-- Model: dwie krawędzie o rozłącznych znaczeniach.
--   * plays.meeting_id          — spotkanie, NA KTÓRYM PARTIA SIĘ ZACZĘŁA;
--                                 nieruchoma kotwica, nigdy nie przepinana,
--                                 tu bez zmian.
--   * meetings.continued_play_id — "na tym wieczorze wracamy do tej partii".
--
-- Historia sesji jednej rozgrywki to suma obu krawędzi posortowana po
-- starts_at. Jeden wpis w plays obsługuje dowolną liczbę wieczorów, więc
-- punkty (play_logged) i odznaki nadal naliczają się dokładnie raz, przy
-- przejściu partii w status 'completed'. Ta migracja nie dotyka ani cennika
-- punktów, ani predykatów osiągnięć — w szczególności camp_host zostaje
-- policzony po plays.meeting_id, tak jak dotąd.
--
-- Jedno spotkanie kontynuuje maksymalnie jedną partię (kolumna, nie tabela);
-- jedna partia może być kontynuowana na wielu spotkaniach (N wierszy
-- meetings wskazujących ten sam play_id).

-- 1. Kolumna --------------------------------------------------------------
--
-- on delete set null obsługuje twarde usunięcie partii (RPC delete_play):
-- spotkanie zostaje, traci tylko wskaźnik. Przy usuwaniu SPOTKANIA ta ścieżka
-- nie działa — spotkania kasujemy miękko (deleted_at) — dlatego niżej
-- delete_meeting dostaje własny guard.

alter table public.meetings
  add column continued_play_id uuid
    references public.plays (id) on delete set null;

create index meetings_continued_play_idx
  on public.meetings (continued_play_id)
  where continued_play_id is not null;

-- Świadomie BEZ `grant update (continued_play_id)`. 20260728120000 odebrała
-- authenticated ogólny UPDATE na meetings i przywróciła go jako grant
-- kolumnowy dla konkretnych kolumn. Nowa kolumna do tej listy nie trafia, więc
-- jedyną drogą zapisu są funkcje *_meeting_with_invitations (security
-- definer) — a to znaczy, że walidacji poniżej nie da się ominąć.

-- 2. Walidacja wskaźnika ---------------------------------------------------
--
-- Sprawdzana WYŁĄCZNIE w momencie ustawiania/zmiany wskaźnika. Partia
-- kontynuowana, którą później zamknięto ('completed'), zostaje w historii
-- spotkania i nie może blokować dalszej edycji tego spotkania — dlatego
-- update woła tę funkcję tylko przy faktycznej zmianie wartości.

create function private.assert_valid_continued_play(
  p_meeting_id uuid,
  p_play_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.play_status;
  v_start_meeting_id uuid;
begin
  if p_play_id is null then
    return;
  end if;

  select play.status, play.meeting_id
  into v_status, v_start_meeting_id
  from public.plays as play
  where play.id = p_play_id;

  if not found then
    raise exception 'Continued play does not exist'
      using errcode = '23503';
  end if;

  if v_status <> 'in_progress'::public.play_status then
    raise exception 'Only a play in progress can be continued at another meeting'
      using errcode = '23514';
  end if;

  -- Spotkanie startowe nie jest własną kontynuacją — inaczej ta sama sesja
  -- pojawiłaby się w historii partii dwa razy.
  if p_meeting_id is not null and v_start_meeting_id = p_meeting_id then
    raise exception 'A meeting cannot continue a play that already starts at it'
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function private.assert_valid_continued_play(uuid, uuid)
from public, anon, authenticated;

-- 3. RPC: utworzenie spotkania --------------------------------------------
--
-- Stara sygnatura jest jawnie usuwana, a nie przykrywana przez `create or
-- replace`: parametr z default utworzyłby drugi overload, a wtedy wywołanie
-- bez p_continued_play_id cicho trafiałoby w starą wersję (ten sam wzorzec co
-- w 20260706000100 dla create/update_play_with_participants).

drop function if exists public.create_meeting_with_invitations(
  text, timestamptz, timestamptz, uuid[], text, text
);

create function public.create_meeting_with_invitations(
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_invited_user_ids uuid[],
  p_description text default null,
  p_location text default null,
  p_continued_play_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_meeting_id uuid;
  v_invited_ids uuid[];
begin
  if current_user_id is null or not private.current_user_can_write() then
    raise exception 'Active membership with write access is required'
      using errcode = '42501';
  end if;

  -- Spotkanie jeszcze nie istnieje, więc samo-kontynuacja jest tu niemożliwa
  -- z definicji; sprawdzamy wyłącznie istnienie i status partii.
  perform private.assert_valid_continued_play(null::uuid, p_continued_play_id);

  insert into public.meetings (
    created_by,
    title,
    description,
    location,
    status,
    starts_at,
    ends_at,
    continued_play_id
  )
  values (
    current_user_id,
    p_title,
    p_description,
    p_location,
    'planned'::public.meeting_status,
    p_starts_at,
    p_ends_at,
    p_continued_play_id
  )
  returning id into v_meeting_id;

  v_invited_ids := private.filter_invitable_user_ids(
    p_invited_user_ids,
    current_user_id
  );

  if array_length(v_invited_ids, 1) > 0 then
    insert into public.meeting_invitations (meeting_id, user_id, invited_by)
    select v_meeting_id, unnest(v_invited_ids), current_user_id;
  end if;

  perform private.enqueue_push_campaign(
    'meeting_created'::public.push_campaign_kind,
    'Nowe spotkanie!',
    'Powstało spotkanie „'
      || left(btrim(p_title), 120)
      || '”. Wybierz gry, w które chcesz zagrać.',
    '/kalendarium/' || v_meeting_id::text,
    'meeting',
    v_meeting_id,
    'meeting_created',
    current_user_id,
    'meeting_created:' || v_meeting_id::text,
    v_invited_ids
  );

  return v_meeting_id;
end;
$$;

revoke all on function public.create_meeting_with_invitations(
  text, timestamptz, timestamptz, uuid[], text, text, uuid
) from public, anon;
grant execute on function public.create_meeting_with_invitations(
  text, timestamptz, timestamptz, uuid[], text, text, uuid
) to authenticated;

-- 4. RPC: edycja spotkania -------------------------------------------------

drop function if exists public.update_meeting_with_invitations(
  uuid, text, timestamptz, timestamptz, uuid[], text, text
);

create function public.update_meeting_with_invitations(
  p_meeting_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_invited_user_ids uuid[],
  p_description text default null,
  p_location text default null,
  p_continued_play_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_creator uuid;
  v_current_continued_play_id uuid;
  v_valid_ids uuid[];
  v_added uuid[];
  v_removed uuid[];
  v_recipient uuid;
begin
  if current_user_id is null or not private.current_user_can_write() then
    raise exception 'Active membership with write access is required'
      using errcode = '42501';
  end if;

  select created_by, continued_play_id
  into v_creator, v_current_continued_play_id
  from public.meetings
  where id = p_meeting_id
    and deleted_at is null;

  if v_creator is null then
    raise exception 'Meeting does not exist'
      using errcode = '23503';
  end if;

  if not (private.is_admin() or v_creator = current_user_id) then
    raise exception 'Only the organizer or an admin can edit this meeting'
      using errcode = '42501';
  end if;

  -- Tylko przy realnej zmianie wskaźnika: zapisana wcześniej kontynuacja
  -- partii, która zdążyła się zakończyć, nie może zablokować edycji tytułu
  -- czy godziny spotkania.
  if p_continued_play_id is distinct from v_current_continued_play_id then
    perform private.assert_valid_continued_play(
      p_meeting_id,
      p_continued_play_id
    );
  end if;

  update public.meetings
  set
    title = p_title,
    description = p_description,
    location = p_location,
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    continued_play_id = p_continued_play_id
  where id = p_meeting_id;

  v_valid_ids := private.filter_invitable_user_ids(
    p_invited_user_ids,
    v_creator
  );

  select coalesce(array_agg(candidate), '{}'::uuid[])
  into v_added
  from unnest(v_valid_ids) as candidate
  where not exists (
    select 1
    from public.meeting_invitations as existing
    where existing.meeting_id = p_meeting_id
      and existing.user_id = candidate
  );

  select coalesce(array_agg(existing.user_id), '{}'::uuid[])
  into v_removed
  from public.meeting_invitations as existing
  where existing.meeting_id = p_meeting_id
    and not (existing.user_id = any (v_valid_ids));

  if array_length(v_removed, 1) > 0 then
    delete from public.meeting_invitations
    where meeting_id = p_meeting_id
      and user_id = any (v_removed);
  end if;

  if array_length(v_added, 1) > 0 then
    insert into public.meeting_invitations (meeting_id, user_id, invited_by)
    select p_meeting_id, unnest(v_added), current_user_id;

    foreach v_recipient in array v_added loop
      perform private.enqueue_push_campaign(
        'meeting_created'::public.push_campaign_kind,
        'Zaproszenie na spotkanie',
        'Zostałeś zaproszony na spotkanie „'
          || left(btrim(p_title), 120)
          || '”. Wybierz gry, w które chcesz zagrać.',
        '/kalendarium/' || p_meeting_id::text,
        'meeting',
        p_meeting_id,
        'meeting_invited',
        current_user_id,
        'meeting_invited:' || p_meeting_id::text || ':' || v_recipient::text,
        array[v_recipient]
      );
    end loop;
  end if;

  return p_meeting_id;
end;
$$;

revoke all on function public.update_meeting_with_invitations(
  uuid, text, timestamptz, timestamptz, uuid[], text, text, uuid
) from public, anon;
grant execute on function public.update_meeting_with_invitations(
  uuid, text, timestamptz, timestamptz, uuid[], text, text, uuid
) to authenticated;

-- 5. delete_meeting: spotkanie z historią partii jest nieusuwalne ----------
--
-- Dotąd blokadą było wyłącznie "na tym spotkaniu zapisano partię"
-- (plays.meeting_id). Kontynuacja jest tak samo częścią historii rozgrywki —
-- gdyby dało się ją skasować, karta partii w Kronice pokazywałaby dziurę w
-- osi sesji. Obie ścieżki mają wyjście awaryjne: wpis Kroniki można usunąć,
-- a powiązanie kontynuacji odznaczyć w edycji spotkania — i o tym mówią
-- komunikaty. Wspólny fragment "jest częścią historii partii w Kronice" jest
-- markerem, po którym warstwa TS rozpoznaje ten błąd (meeting-deletion.ts).

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
