-- Controlled, append-only point corrections performed by an administrator.
-- The balance continues to come exclusively from public.point_events; this
-- table records the administrative context and links reversals to their
-- original ledger event without deleting or mutating either row.

create table public.admin_point_adjustments (
  id uuid primary key default extensions.gen_random_uuid(),
  request_id uuid not null unique,
  admin_user_id uuid not null references public.profiles (id) on delete restrict,
  target_user_id uuid not null references public.profiles (id) on delete restrict,
  action_type text not null check (length(btrim(action_type)) > 0),
  operation text not null,
  delta integer not null check (delta <> 0),
  reason text,
  point_event_id uuid not null unique references public.point_events (id) on delete restrict,
  reversed_point_event_id uuid unique references public.point_events (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint admin_point_adjustments_operation_check check (
    (operation = 'award' and delta > 0 and reversed_point_event_id is null)
    or
    (operation = 'reversal' and delta < 0 and reversed_point_event_id is not null)
  )
);

create index admin_point_adjustments_created_idx
  on public.admin_point_adjustments (created_at desc);
create index admin_point_adjustments_target_created_idx
  on public.admin_point_adjustments (target_user_id, created_at desc);
create index admin_point_adjustments_admin_created_idx
  on public.admin_point_adjustments (admin_user_id, created_at desc);

alter table public.admin_point_adjustments enable row level security;

create policy admin_point_adjustments_select_admin
on public.admin_point_adjustments for select to authenticated
using (private.is_admin());

create trigger admin_point_adjustments_append_only
before update or delete on public.admin_point_adjustments
for each row execute function private.prevent_append_only_mutation();

grant select on public.admin_point_adjustments to authenticated;

create or replace function public.admin_award_point_action(
  p_target_user_id uuid,
  p_action_type text,
  p_reason text default null,
  p_request_id uuid default extensions.gen_random_uuid()
)
returns table (
  adjustment_id uuid,
  point_event_id uuid,
  delta integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adjustment_id uuid := extensions.gen_random_uuid();
  v_point_event_id uuid := extensions.gen_random_uuid();
  v_action_type text := btrim(p_action_type);
  v_points integer;
  v_existing public.admin_point_adjustments%rowtype;
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  if p_target_user_id is null or p_request_id is null then
    raise exception 'Target user and request id are required' using errcode = '22023';
  end if;

  select * into v_existing
  from public.admin_point_adjustments as adjustment
  where adjustment.request_id = p_request_id;

  if found then
    if v_existing.admin_user_id <> auth.uid()
      or v_existing.target_user_id <> p_target_user_id
      or v_existing.action_type <> v_action_type
      or v_existing.operation <> 'award' then
      raise exception 'Request id has already been used for another correction'
        using errcode = '23505';
    end if;

    return query select
      v_existing.id,
      v_existing.point_event_id,
      v_existing.delta,
      v_existing.created_at;
    return;
  end if;

  if not private.is_active_member(p_target_user_id) then
    raise exception 'Point recipient must be an active member'
      using errcode = '42501';
  end if;

  -- This is the allow-list: callers never supply an arbitrary point value.
  v_points := private.point_reward_for(v_action_type);

  insert into public.point_events (
    id,
    user_id,
    points,
    action_type,
    description,
    related_entity_type,
    related_entity_id,
    created_by
  ) values (
    v_point_event_id,
    p_target_user_id,
    v_points,
    'admin_award:' || v_action_type,
    null,
    'admin_point_adjustment',
    v_adjustment_id,
    auth.uid()
  );

  insert into public.admin_point_adjustments (
    id,
    request_id,
    admin_user_id,
    target_user_id,
    action_type,
    operation,
    delta,
    reason,
    point_event_id
  ) values (
    v_adjustment_id,
    p_request_id,
    auth.uid(),
    p_target_user_id,
    v_action_type,
    'award',
    v_points,
    nullif(btrim(p_reason), ''),
    v_point_event_id
  );

  return query
  select
    adjustment.id,
    adjustment.point_event_id,
    adjustment.delta,
    adjustment.created_at
  from public.admin_point_adjustments as adjustment
  where adjustment.id = v_adjustment_id;
end;
$$;

create or replace function public.admin_reverse_point_event(
  p_point_event_id uuid,
  p_reason text default null,
  p_request_id uuid default extensions.gen_random_uuid()
)
returns table (
  adjustment_id uuid,
  point_event_id uuid,
  delta integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adjustment_id uuid := extensions.gen_random_uuid();
  v_reversal_event_id uuid := extensions.gen_random_uuid();
  v_original public.point_events%rowtype;
  v_existing public.admin_point_adjustments%rowtype;
  v_action_type text;
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  if p_point_event_id is null or p_request_id is null then
    raise exception 'Point event and request id are required' using errcode = '22023';
  end if;

  select * into v_existing
  from public.admin_point_adjustments as adjustment
  where adjustment.request_id = p_request_id;

  if found then
    if v_existing.admin_user_id <> auth.uid()
      or v_existing.reversed_point_event_id <> p_point_event_id
      or v_existing.operation <> 'reversal' then
      raise exception 'Request id has already been used for another correction'
        using errcode = '23505';
    end if;

    return query select
      v_existing.id,
      v_existing.point_event_id,
      v_existing.delta,
      v_existing.created_at;
    return;
  end if;

  select * into v_original
  from public.point_events as event
  where event.id = p_point_event_id;

  if not found then
    raise exception 'Point event not found' using errcode = 'P0002';
  end if;

  if v_original.points <= 0 then
    raise exception 'Only a positive point event can be reversed'
      using errcode = '22023';
  end if;

  if v_original.action_type not like 'admin_award:%'
    and exists (
      select 1
      from public.point_events as compensation
      where compensation.user_id = v_original.user_id
        and compensation.action_type = v_original.action_type
        and compensation.related_entity_type is not distinct from v_original.related_entity_type
        and compensation.related_entity_id is not distinct from v_original.related_entity_id
        and compensation.reward_revision > v_original.reward_revision
        and compensation.points < 0
    ) then
    raise exception 'Point event is no longer an active positive reward'
      using errcode = '23505';
  end if;

  if not private.is_active_member(v_original.user_id) then
    raise exception 'Point recipient must be an active member'
      using errcode = '42501';
  end if;

  v_action_type := case
    when v_original.action_type like 'admin_award:%'
      then substr(v_original.action_type, length('admin_award:') + 1)
    else v_original.action_type
  end;

  -- Reject achievements and arbitrary/manual events. Only the known quest
  -- action catalog may be managed through this narrow correction endpoint.
  perform private.point_reward_for(v_action_type);

  if exists (
    select 1
    from public.admin_point_adjustments as adjustment
    where adjustment.reversed_point_event_id = p_point_event_id
  ) then
    raise exception 'Point event has already been reversed'
      using errcode = '23505';
  end if;

  insert into public.point_events (
    id,
    user_id,
    points,
    action_type,
    description,
    related_entity_type,
    related_entity_id,
    created_by
  ) values (
    v_reversal_event_id,
    v_original.user_id,
    -v_original.points,
    'admin_reversal:' || v_action_type,
    null,
    'admin_point_adjustment',
    v_adjustment_id,
    auth.uid()
  );

  insert into public.admin_point_adjustments (
    id,
    request_id,
    admin_user_id,
    target_user_id,
    action_type,
    operation,
    delta,
    reason,
    point_event_id,
    reversed_point_event_id
  ) values (
    v_adjustment_id,
    p_request_id,
    auth.uid(),
    v_original.user_id,
    v_action_type,
    'reversal',
    -v_original.points,
    nullif(btrim(p_reason), ''),
    v_reversal_event_id,
    p_point_event_id
  );

  return query
  select
    adjustment.id,
    adjustment.point_event_id,
    adjustment.delta,
    adjustment.created_at
  from public.admin_point_adjustments as adjustment
  where adjustment.id = v_adjustment_id;
end;
$$;

create or replace function public.admin_list_point_adjustments(
  p_limit integer default 40
)
returns table (
  adjustment_id uuid,
  admin_user_id uuid,
  admin_display_name text,
  target_user_id uuid,
  target_display_name text,
  action_type text,
  operation text,
  delta integer,
  reason text,
  point_event_id uuid,
  reversed_point_event_id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  return query
  select
    adjustment.id,
    adjustment.admin_user_id,
    admin_profile.display_name,
    adjustment.target_user_id,
    target_profile.display_name,
    adjustment.action_type,
    adjustment.operation,
    adjustment.delta,
    adjustment.reason,
    adjustment.point_event_id,
    adjustment.reversed_point_event_id,
    adjustment.created_at
  from public.admin_point_adjustments as adjustment
  join public.profiles as admin_profile on admin_profile.id = adjustment.admin_user_id
  join public.profiles as target_profile on target_profile.id = adjustment.target_user_id
  order by adjustment.created_at desc, adjustment.id desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
end;
$$;

create or replace function public.admin_list_reversible_point_events(
  p_limit integer default 150
)
returns table (
  point_event_id uuid,
  target_user_id uuid,
  target_display_name text,
  action_type text,
  points integer,
  description text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  return query
  select
    event.id,
    event.user_id,
    profile.display_name,
    case
      when event.action_type like 'admin_award:%'
        then substr(event.action_type, length('admin_award:') + 1)
      else event.action_type
    end,
    event.points,
    event.description,
    event.created_at
  from public.point_events as event
  join public.profiles as profile on profile.id = event.user_id
  where event.points > 0
    and (
      event.action_type in (
        'shelf_first_game',
        'shelf_5_games',
        'shelf_10_games',
        'shelf_15_games',
        'meeting_rsvp',
        'meeting_vote',
        'meeting_created',
        'rating_created',
        'play_logged'
      )
      or event.action_type like 'admin_award:%'
    )
    and not exists (
      select 1
      from public.admin_point_adjustments as reversal
      where reversal.reversed_point_event_id = event.id
    )
    and (
      event.action_type like 'admin_award:%'
      or not exists (
        select 1
        from public.point_events as compensation
        where compensation.user_id = event.user_id
          and compensation.action_type = event.action_type
          and compensation.related_entity_type is not distinct from event.related_entity_type
          and compensation.related_entity_id is not distinct from event.related_entity_id
          and compensation.reward_revision > event.reward_revision
          and compensation.points < 0
      )
    )
  order by event.created_at desc, event.id desc
  limit greatest(1, least(coalesce(p_limit, 150), 300));
end;
$$;

revoke all on function public.admin_award_point_action(uuid, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.admin_reverse_point_event(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.admin_list_point_adjustments(integer)
  from public, anon, authenticated;
revoke all on function public.admin_list_reversible_point_events(integer)
  from public, anon, authenticated;

grant execute on function public.admin_award_point_action(uuid, text, text, uuid)
  to authenticated;
grant execute on function public.admin_reverse_point_event(uuid, text, uuid)
  to authenticated;
grant execute on function public.admin_list_point_adjustments(integer)
  to authenticated;
grant execute on function public.admin_list_reversible_point_events(integer)
  to authenticated;
