-- Zaproszenia na spotkanie wybierane przez organizatora.
--
-- Do tej pory tworzenie spotkania automatycznie "zapraszało" (powiadamiało
-- push-em) wszystkich aktywnych member+admin — trigger z_meetings_enqueue_push
-- wywoływał enqueue_meeting_created_push(), które budowało audience jako
-- WSZYSCY aktywni member/admin. Ten trigger jest tu usuwany.
--
-- Nowy model: organizator wybiera zapraszanych w formularzu. Zaproszenie jest
-- realnym bytem (tabela meeting_invitations), nie tylko efektem ubocznym
-- powiadomienia. Organizator sam nie jest wierszem w tej tabeli — wynika
-- wprost z meetings.created_by, więc nie da się go "usunąć z zaproszonych"
-- przez pomyłkę, bo nigdy tam nie jest.
--
-- Widoczność spotkań i możliwość RSVP (meeting_availability) NIE są tu
-- zawężane — każdy aktywny member nadal widzi każde spotkanie w Kalendarium
-- i może na nie odpowiedzieć. Zaproszenie kontroluje wyłącznie to, kto dostaje
-- realne zaproszenie/powiadomienie i kto pojawia się na liście "Kto będzie?".
--
-- Zapisy wyłącznie przez transakcyjne RPC (ten sam wzorzec co
-- meeting_game_responses/meeting_game_proposals): authenticated dostaje na tej
-- tabeli sam select.

-- 1. Tabela -------------------------------------------------------------

create table public.meeting_invitations (
  meeting_id uuid not null
    references public.meetings (id) on delete cascade,
  user_id uuid not null
    references public.profiles (id) on delete cascade,
  invited_by uuid not null
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

alter table public.meeting_invitations enable row level security;

create index meeting_invitations_user_id_idx
  on public.meeting_invitations (user_id);

create policy meeting_invitations_select_members
on public.meeting_invitations for select to authenticated
using (
  private.is_active_member()
  and exists (
    select 1
    from public.meetings as parent
    where parent.id = meeting_invitations.meeting_id
      and parent.deleted_at is null
  )
);

revoke all on public.meeting_invitations from public, anon;
grant select on public.meeting_invitations to authenticated;
grant select, insert, update, delete on public.meeting_invitations
  to service_role;

-- 2. Usunięcie automatycznego zapraszania wszystkich ---------------------

drop trigger if exists z_meetings_enqueue_push on public.meetings;
drop function if exists private.enqueue_meeting_created_push();

-- 3. Wspólny filtr zaproszonych -------------------------------------------
--
-- Jedno źródło prawdy dla "kto może zostać zaproszony": aktywny member (nie
-- admin, nie observer — ta sama pula co picker uczestników partii), różny od
-- organizatora, bez duplikatów. Klient nigdy nie jest tu ufany — id spoza tej
-- puli są po prostu pomijane, nie powodują błędu, żeby manualna manipulacja
-- requestem nie mogła dopisać nikogo spoza grupy ani zablokować zapisu.

create or replace function private.filter_invitable_user_ids(
  p_candidate_ids uuid[],
  p_organizer_id uuid
)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct membership.user_id), '{}'::uuid[])
  from public.app_members as membership
  where membership.is_active = true
    and membership.role = 'member'::public.membership_role
    and membership.user_id = any (coalesce(p_candidate_ids, '{}'::uuid[]))
    and membership.user_id <> p_organizer_id;
$$;

revoke all on function private.filter_invitable_user_ids(uuid[], uuid)
from public, anon, authenticated;

-- 4. RPC: utworzenie spotkania z zaproszeniami ----------------------------
--
-- Atomowo: spotkanie + zaproszenia (tylko dla przefiltrowanej listy) + jedna
-- kampania push, jeśli lista nie jest pusta. Ta sama treść co dawny trigger —
-- zmienia się wyłącznie audience (zaproszeni zamiast wszystkich). Pusta lista
-- zaproszonych jest poprawnym przypadkiem: spotkanie powstaje, kampania push
-- się nie wysyła (enqueue_push_campaign z pustą tablicą odbiorców po prostu
-- nie tworzy żadnej dostawy).

-- Parametry z default muszą być na końcu listy (wymóg Postgresa) — dlatego
-- opcjonalne p_description/p_location są ostatnie, mimo że logicznie
-- pasowałyby zaraz po tytule. default null (nie tylko `text`) jest konieczne:
-- generator typów Supabase nie potrafi wyrazić "text | null" dla argumentu
-- funkcji, więc bez defaultu TS wymuszałby string mimo nullable kolumny.
create or replace function public.create_meeting_with_invitations(
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_invited_user_ids uuid[],
  p_description text default null,
  p_location text default null
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

  insert into public.meetings (
    created_by, title, description, location, status, starts_at, ends_at
  )
  values (
    current_user_id,
    p_title,
    p_description,
    p_location,
    'planned'::public.meeting_status,
    p_starts_at,
    p_ends_at
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
  text, timestamptz, timestamptz, uuid[], text, text
) from public, anon;
grant execute on function public.create_meeting_with_invitations(
  text, timestamptz, timestamptz, uuid[], text, text
) to authenticated;

-- 5. RPC: edycja spotkania z zaproszeniami --------------------------------
--
-- Uprawnienia lustrzane wobec meetings_update_creator_or_admin (organizator
-- albo admin, funkcja jako SECURITY DEFINER omija RLS, więc sprawdzamy to
-- ręcznie). Lista zaproszonych jest diffowana względem obecnego stanu:
--   * nowi (w nowej liście, bez istniejącego wiersza) -> insert + osobna
--     kampania push per osoba (dedupe_key po meeting+user, więc podwójny
--     submit tego samego edita nie wysyła drugi raz),
--   * usunięci (mieli wiersz, znikają z nowej listy) -> delete wiersza,
--   * niezmienieni -> żadnej operacji, żadnego powiadomienia.
-- meeting_availability (RSVP) pozostaje nietknięte — usunięcie zaproszenia
-- nie kasuje wcześniejszej odpowiedzi, bo RSVP nigdy nie było wyłącznie
-- pochodną zaproszenia.

-- Ta sama zasada kolejności co w create_meeting_with_invitations powyżej:
-- opcjonalne parametry (default null) muszą być na końcu.
create or replace function public.update_meeting_with_invitations(
  p_meeting_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_invited_user_ids uuid[],
  p_description text default null,
  p_location text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_creator uuid;
  v_valid_ids uuid[];
  v_added uuid[];
  v_removed uuid[];
  v_recipient uuid;
begin
  if current_user_id is null or not private.current_user_can_write() then
    raise exception 'Active membership with write access is required'
      using errcode = '42501';
  end if;

  select created_by into v_creator
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

  update public.meetings
  set
    title = p_title,
    description = p_description,
    location = p_location,
    starts_at = p_starts_at,
    ends_at = p_ends_at
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
  uuid, text, timestamptz, timestamptz, uuid[], text, text
) from public, anon;
grant execute on function public.update_meeting_with_invitations(
  uuid, text, timestamptz, timestamptz, uuid[], text, text
) to authenticated;
