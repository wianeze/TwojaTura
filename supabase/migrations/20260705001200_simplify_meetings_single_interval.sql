create temporary table tmp_canonical_meeting_options on commit drop as
select distinct on (meeting.id)
  meeting.id as meeting_id,
  option.id as meeting_option_id,
  option.starts_at,
  coalesce(option.ends_at, option.starts_at + interval '3 hours') as ends_at
from public.meetings as meeting
join public.meeting_options as option
  on option.meeting_id = meeting.id
order by
  meeting.id,
  case
    when meeting.selected_option_id is not null
      and option.id = meeting.selected_option_id
      then 0
    else 1
  end,
  option.starts_at;

alter table public.meetings
  add column starts_at timestamptz,
  add column ends_at timestamptz;

update public.meetings as meeting
set
  starts_at = canonical.starts_at,
  ends_at = canonical.ends_at
from tmp_canonical_meeting_options as canonical
where canonical.meeting_id = meeting.id;

do $$
begin
  if exists (
    select 1
    from public.meetings
    where starts_at is null or ends_at is null
  ) then
    raise exception 'Every meeting must resolve to a canonical starts_at and ends_at interval'
      using errcode = '23514';
  end if;
end;
$$;

create temporary table tmp_meeting_availability on commit drop as
select
  canonical.meeting_id,
  availability.user_id,
  availability.is_available,
  availability.updated_at
from public.meeting_availability as availability
join tmp_canonical_meeting_options as canonical
  on canonical.meeting_option_id = availability.meeting_option_id;

drop view if exists public.meeting_option_summaries;

drop function if exists public.create_meeting_with_options(
  text,
  text,
  text,
  public.meeting_status,
  jsonb
);

drop function if exists public.update_meeting_with_options(
  uuid,
  text,
  text,
  text,
  public.meeting_status,
  jsonb
);

truncate table public.meeting_availability;

alter table public.meeting_availability
  drop constraint meeting_availability_pkey,
  drop constraint meeting_availability_meeting_option_id_fkey;

alter table public.meeting_availability
  add column meeting_id uuid;

insert into public.meeting_availability (
  meeting_id,
  user_id,
  is_available,
  updated_at
)
select
  meeting_id,
  user_id,
  is_available,
  updated_at
from tmp_meeting_availability;

alter table public.meeting_availability
  alter column meeting_id set not null;

alter table public.meeting_availability
  add constraint meeting_availability_meeting_id_fkey
  foreign key (meeting_id)
  references public.meetings (id)
  on delete cascade;

alter table public.meeting_availability
  add constraint meeting_availability_pkey
  primary key (meeting_id, user_id);

alter table public.meeting_availability
  drop column meeting_option_id;

alter table public.meetings
  drop constraint meetings_selected_option_same_meeting_fk;

alter table public.meetings
  drop column selected_option_id,
  alter column starts_at set not null,
  alter column ends_at set not null,
  add constraint meetings_time_check check (ends_at > starts_at);

create index if not exists meetings_starts_at_idx
  on public.meetings (starts_at);

drop table public.meeting_options;

drop policy if exists meeting_availability_select_members on public.meeting_availability;
drop policy if exists meeting_availability_insert_own on public.meeting_availability;
drop policy if exists meeting_availability_update_own on public.meeting_availability;
drop policy if exists meeting_availability_delete_own on public.meeting_availability;

create policy meeting_availability_select_members
on public.meeting_availability for select to authenticated
using (private.is_active_member());

create policy meeting_availability_insert_own
on public.meeting_availability for insert to authenticated
with check (private.is_active_member() and user_id = auth.uid());

create policy meeting_availability_update_own
on public.meeting_availability for update to authenticated
using (private.is_active_member() and user_id = auth.uid())
with check (private.is_active_member() and user_id = auth.uid());

create policy meeting_availability_delete_own
on public.meeting_availability for delete to authenticated
using (private.is_active_member() and user_id = auth.uid());
