-- Etap C1: photos attached to a Chronicle play. Metadata lives in
-- public.play_photos; the actual files live in the private "play-photos"
-- Storage bucket at {play_id}/{photo_id}.{webp|jpg}. Position, the 15-photo
-- count cap and the 15 MB total-size cap are enforced in SQL so no upload
-- path (client bug, retried request, concurrent uploads) can bypass them.

create table public.play_photos (
  id uuid primary key default extensions.gen_random_uuid(),
  play_id uuid not null references public.plays (id) on delete cascade,
  storage_path text not null unique,
  position smallint not null check (position between 1 and 15),
  byte_size integer not null check (byte_size > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint play_photos_play_id_position_key
    unique (play_id, position) deferrable initially deferred
);

create index play_photos_play_id_idx on public.play_photos (play_id);

-- Locks the parent play row so concurrent uploads for the same play (the
-- client uploads up to 3 in parallel) serialize here instead of racing on
-- "next position" or both slipping past the count/size cap at once.
create or replace function private.prepare_play_photo_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  existing_count integer;
  existing_bytes bigint;
begin
  perform 1 from public.plays where id = new.play_id for update;

  select count(*), coalesce(sum(byte_size), 0)
  into existing_count, existing_bytes
  from public.play_photos
  where play_id = new.play_id;

  if existing_count >= 15 then
    raise exception 'A play cannot have more than 15 photos'
      using errcode = '23514';
  end if;

  if existing_bytes + new.byte_size > 15 * 1024 * 1024 then
    raise exception 'Play photos cannot exceed 15 MB in total'
      using errcode = '23514';
  end if;

  new.position := existing_count + 1;
  return new;
end;
$$;

create trigger z_play_photos_prepare_insert
before insert on public.play_photos
for each row execute function private.prepare_play_photo_insert();

alter table public.play_photos enable row level security;

create policy play_photos_select_members
on public.play_photos for select to authenticated
using (private.is_active_member());

create policy play_photos_insert_owner_or_admin
on public.play_photos for insert to authenticated
with check (
  private.is_active_member()
  and exists (
    select 1
    from public.plays as parent
    where parent.id = play_photos.play_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
);

create policy play_photos_update_owner_or_admin
on public.play_photos for update to authenticated
using (
  private.is_active_member()
  and exists (
    select 1
    from public.plays as parent
    where parent.id = play_photos.play_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
)
with check (
  private.is_active_member()
  and exists (
    select 1
    from public.plays as parent
    where parent.id = play_photos.play_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
);

create policy play_photos_delete_owner_or_admin
on public.play_photos for delete to authenticated
using (
  private.is_active_member()
  and exists (
    select 1
    from public.plays as parent
    where parent.id = play_photos.play_id
      and (private.is_admin() or parent.created_by = auth.uid())
  )
);

grant select, insert, update, delete on public.play_photos to authenticated;

-- Reordering rewrites every position in one statement so the deferred
-- unique(play_id, position) constraint never sees an intermediate collision
-- (e.g. swapping positions 1 and 2).
create or replace function public.reorder_play_photos(
  p_play_id uuid,
  p_photo_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  existing_ids uuid[];
  requested_sorted uuid[];
  existing_sorted uuid[];
  photo_id uuid;
  next_position integer := 0;
begin
  if current_user_id is null or not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.plays
    where id = p_play_id
      and (created_by = current_user_id or private.is_admin(current_user_id))
  ) then
    raise exception 'Only the play author or an administrator can reorder photos'
      using errcode = '42501';
  end if;

  select coalesce(array_agg(id), array[]::uuid[])
  into existing_ids
  from public.play_photos
  where play_id = p_play_id;

  select coalesce(array_agg(x order by x), array[]::uuid[])
  into requested_sorted
  from unnest(coalesce(p_photo_ids, array[]::uuid[])) as x;

  select coalesce(array_agg(x order by x), array[]::uuid[])
  into existing_sorted
  from unnest(existing_ids) as x;

  if requested_sorted <> existing_sorted then
    raise exception 'Photo order must reference exactly the play''s existing photos'
      using errcode = '22023';
  end if;

  foreach photo_id in array p_photo_ids
  loop
    next_position := next_position + 1;
    update public.play_photos
    set position = next_position
    where id = photo_id
      and play_id = p_play_id;
  end loop;
end;
$$;

revoke all on function public.reorder_play_photos(uuid, uuid[])
from public, anon, authenticated;

grant execute on function public.reorder_play_photos(uuid, uuid[])
to authenticated;

-- Private bucket: only ever holds the compressed webp/jpeg output of the
-- client-side pipeline, so the mime/size allow-list is a real backstop, not
-- just documentation.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('play-photos', 'play-photos', false, 2097152, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy play_photos_storage_select_members
on storage.objects for select to authenticated
using (
  bucket_id = 'play-photos'
  and private.is_active_member()
);

create policy play_photos_storage_insert_owner_or_admin
on storage.objects for insert to authenticated
with check (
  bucket_id = 'play-photos'
  and private.is_active_member()
  and exists (
    select 1
    from public.plays
    where id::text = (storage.foldername(name))[1]
      and (created_by = auth.uid() or private.is_admin())
  )
);

create policy play_photos_storage_delete_owner_or_admin
on storage.objects for delete to authenticated
using (
  bucket_id = 'play-photos'
  and private.is_active_member()
  and exists (
    select 1
    from public.plays
    where id::text = (storage.foldername(name))[1]
      and (created_by = auth.uid() or private.is_admin())
  )
);
