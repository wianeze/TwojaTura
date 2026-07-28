-- MVP 2: meeting deletion is an atomic, reversible-points soft delete.
-- Historical RSVP/votes stay in place and meetings linked to Chronicle plays
-- cannot be deleted.

alter table public.meetings
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete restrict,
  add column deleted_reason text,
  add constraint meetings_soft_delete_actor_check check (
    (deleted_at is null and deleted_by is null)
    or (deleted_at is not null and deleted_by is not null)
  );

create index meetings_deleted_at_idx
  on public.meetings (deleted_at)
  where deleted_at is not null;

-- Deleted meetings are hidden at the database boundary as well as in the app.
drop policy if exists meetings_select_members on public.meetings;
create policy meetings_select_members
on public.meetings for select to authenticated
using (private.is_active_member() and deleted_at is null);

drop policy if exists meetings_update_creator_or_admin on public.meetings;
create policy meetings_update_creator_or_admin
on public.meetings for update to authenticated
using (
  private.current_user_can_write()
  and deleted_at is null
  and (private.is_admin() or created_by = auth.uid())
)
with check (
  private.current_user_can_write()
  and deleted_at is null
  and (private.is_admin() or created_by = auth.uid())
);

-- Hard delete is not part of the product contract.
drop policy if exists meetings_delete_creator_or_admin on public.meetings;
revoke delete on public.meetings from authenticated;

-- Deletion metadata can only be written by delete_meeting(). Direct meeting
-- edits keep the existing RLS contract but cannot impersonate a soft delete.
revoke update on public.meetings from authenticated;
grant update (
  title,
  description,
  location,
  status,
  starts_at,
  ends_at,
  updated_at
) on public.meetings to authenticated;

-- RSVP and votes are retained physically, hidden after deletion, and cannot be
-- changed once their parent meeting has been deleted.
drop policy if exists meeting_availability_select_members on public.meeting_availability;
create policy meeting_availability_select_members
on public.meeting_availability for select to authenticated
using (
  private.is_active_member()
  and exists (
    select 1
    from public.meetings as parent
    where parent.id = meeting_availability.meeting_id
      and parent.deleted_at is null
  )
);

drop policy if exists meeting_availability_insert_own on public.meeting_availability;
create policy meeting_availability_insert_own
on public.meeting_availability for insert to authenticated
with check (
  private.current_user_can_write()
  and user_id = auth.uid()
  and exists (
    select 1
    from public.meetings as parent
    where parent.id = meeting_availability.meeting_id
      and parent.deleted_at is null
  )
);

drop policy if exists meeting_availability_update_own on public.meeting_availability;
create policy meeting_availability_update_own
on public.meeting_availability for update to authenticated
using (
  private.current_user_can_write()
  and (private.is_admin() or user_id = auth.uid())
  and exists (
    select 1
    from public.meetings as parent
    where parent.id = meeting_availability.meeting_id
      and parent.deleted_at is null
  )
)
with check (
  private.current_user_can_write()
  and (private.is_admin() or user_id = auth.uid())
  and exists (
    select 1
    from public.meetings as parent
    where parent.id = meeting_availability.meeting_id
      and parent.deleted_at is null
  )
);

drop policy if exists meeting_availability_delete_own on public.meeting_availability;
create policy meeting_availability_delete_own
on public.meeting_availability for delete to authenticated
using (
  private.current_user_can_write()
  and (private.is_admin() or user_id = auth.uid())
  and exists (
    select 1
    from public.meetings as parent
    where parent.id = meeting_availability.meeting_id
      and parent.deleted_at is null
  )
);

drop policy if exists meeting_game_votes_select_members on public.meeting_game_votes;
create policy meeting_game_votes_select_members
on public.meeting_game_votes for select to authenticated
using (
  private.is_active_member()
  and exists (
    select 1
    from public.meetings as parent
    where parent.id = meeting_game_votes.meeting_id
      and parent.deleted_at is null
  )
);

drop policy if exists meeting_game_votes_insert_own on public.meeting_game_votes;
create policy meeting_game_votes_insert_own
on public.meeting_game_votes for insert to authenticated
with check (
  private.current_user_can_write()
  and user_id = auth.uid()
  and exists (
    select 1
    from public.meetings as parent
    where parent.id = meeting_game_votes.meeting_id
      and parent.deleted_at is null
  )
);

drop policy if exists meeting_game_votes_delete_own on public.meeting_game_votes;
create policy meeting_game_votes_delete_own
on public.meeting_game_votes for delete to authenticated
using (
  private.current_user_can_write()
  and (private.is_admin() or user_id = auth.uid())
  and exists (
    select 1
    from public.meetings as parent
    where parent.id = meeting_game_votes.meeting_id
      and parent.deleted_at is null
  )
);

-- Central guard: even a direct call to an existing point-award RPC cannot add
-- fresh meeting points after the meeting has been soft-deleted.
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
    and p_action_type in ('meeting_created', 'meeting_rsvp', 'meeting_vote')
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
begin
  if current_user_id is null
    or not private.current_user_can_write() then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  select meeting.created_by, meeting.deleted_at
  into meeting_creator_id, meeting_deleted_at
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
    raise exception 'Nie można usunąć spotkania z zapisaną partią w Kronice.'
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

grant execute on function public.delete_meeting(uuid)
to authenticated;
