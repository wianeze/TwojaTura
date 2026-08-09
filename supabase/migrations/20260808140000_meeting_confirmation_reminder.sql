-- Organizer od razu deklaruje udział, a po dwóch pozytywnych odpowiedziach
-- innych osób dostaje jedno przypomnienie o potwierdzeniu spotkania.

drop function if exists public.create_meeting_with_invitations(
  text, timestamptz, timestamptz, uuid[], text, text, uuid
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

  -- To element utworzenia spotkania, a nie osobna akcja RSVP. Dlatego nie
  -- uruchamia punktów za odpowiedź i nie może tworzyć dodatkowej nagrody.
  insert into public.meeting_availability (meeting_id, user_id, is_available)
  values (v_meeting_id, current_user_id, true);

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

create function public.enqueue_meeting_confirmation_reminder(
  p_meeting_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_meeting public.meetings%rowtype;
  v_available_count integer;
begin
  if current_user_id is null or not private.current_user_can_write() then
    raise exception 'Active membership with write access is required'
      using errcode = '42501';
  end if;

  select meeting.*
  into v_meeting
  from public.meetings as meeting
  where meeting.id = p_meeting_id
    and meeting.deleted_at is null;

  if not found then
    raise exception 'Meeting does not exist'
      using errcode = '23503';
  end if;

  -- Wąskie RPC wolno wywołać dopiero po zapisaniu własnej odpowiedzi. Nie jest
  -- to ogólny endpoint pozwalający dowolnemu członkowi generować kampanie.
  if not exists (
    select 1
    from public.meeting_availability as availability
    where availability.meeting_id = p_meeting_id
      and availability.user_id = current_user_id
  ) then
    raise exception 'Meeting response is required'
      using errcode = '42501';
  end if;

  if v_meeting.status <> 'planned'::public.meeting_status then
    return false;
  end if;

  select count(*)::integer
  into v_available_count
  from public.meeting_availability as availability
  where availability.meeting_id = p_meeting_id
    and availability.is_available = true
    and availability.user_id <> v_meeting.created_by;

  if v_available_count < 2 then
    return false;
  end if;

  if exists (
    select 1
    from public.push_campaigns as campaign
    where campaign.dedupe_key = 'meeting-confirm-reminder:'
      || p_meeting_id::text
      || ':two-attendees'
  ) then
    return false;
  end if;

  perform private.enqueue_push_campaign(
    'meeting_created'::public.push_campaign_kind,
    'Twoja Tura!',
    'Pamiętaj potwierdzić spotkanie',
    '/kalendarium/' || p_meeting_id::text,
    'meeting',
    p_meeting_id,
    'meeting_confirm_reminder',
    current_user_id,
    'meeting-confirm-reminder:' || p_meeting_id::text || ':two-attendees',
    array[v_meeting.created_by]
  );

  return true;
end;
$$;

revoke all on function public.enqueue_meeting_confirmation_reminder(uuid)
from public, anon;
grant execute on function public.enqueue_meeting_confirmation_reminder(uuid)
to authenticated;
