create or replace function public.create_meeting_with_options(
  p_title text,
  p_description text,
  p_location text,
  p_status public.meeting_status,
  p_options jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_meeting_id uuid;
begin
  if jsonb_typeof(coalesce(p_options, '[]'::jsonb)) <> 'array' then
    raise exception 'Meeting options payload must be a JSON array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_options, '[]'::jsonb)) = 0 then
    raise exception 'Meeting must contain at least one option'
      using errcode = '23514';
  end if;

  insert into public.meetings (
    title,
    description,
    location,
    status,
    created_by
  )
  values (
    p_title,
    p_description,
    p_location,
    p_status,
    auth.uid()
  )
  returning id into created_meeting_id;

  insert into public.meeting_options (
    meeting_id,
    starts_at,
    ends_at,
    label
  )
  select
    created_meeting_id,
    option_item.starts_at,
    option_item.ends_at,
    nullif(btrim(option_item.label), '')
  from jsonb_to_recordset(coalesce(p_options, '[]'::jsonb)) as option_item(
    starts_at timestamptz,
    ends_at timestamptz,
    label text
  );

  return created_meeting_id;
end;
$$;

create or replace function public.update_meeting_with_options(
  p_meeting_id uuid,
  p_title text,
  p_description text,
  p_location text,
  p_status public.meeting_status,
  p_options jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_meeting_id uuid;
begin
  if jsonb_typeof(coalesce(p_options, '[]'::jsonb)) <> 'array' then
    raise exception 'Meeting options payload must be a JSON array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_options, '[]'::jsonb)) = 0 then
    raise exception 'Meeting must contain at least one option'
      using errcode = '23514';
  end if;

  update public.meetings
  set
    title = p_title,
    description = p_description,
    location = p_location,
    status = p_status,
    selected_option_id = null
  where id = p_meeting_id
  returning id into updated_meeting_id;

  if updated_meeting_id is null then
    return null;
  end if;

  delete from public.meeting_options
  where meeting_id = p_meeting_id;

  insert into public.meeting_options (
    meeting_id,
    starts_at,
    ends_at,
    label
  )
  select
    p_meeting_id,
    option_item.starts_at,
    option_item.ends_at,
    nullif(btrim(option_item.label), '')
  from jsonb_to_recordset(coalesce(p_options, '[]'::jsonb)) as option_item(
    starts_at timestamptz,
    ends_at timestamptz,
    label text
  );

  return updated_meeting_id;
end;
$$;

revoke all on function public.create_meeting_with_options(
  text,
  text,
  text,
  public.meeting_status,
  jsonb
) from public;

revoke all on function public.update_meeting_with_options(
  uuid,
  text,
  text,
  text,
  public.meeting_status,
  jsonb
) from public;

grant execute on function public.create_meeting_with_options(
  text,
  text,
  text,
  public.meeting_status,
  jsonb
) to authenticated;

grant execute on function public.update_meeting_with_options(
  uuid,
  text,
  text,
  text,
  public.meeting_status,
  jsonb
) to authenticated;
