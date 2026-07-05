create table public.game_expansions (
  id uuid primary key default extensions.gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  is_owned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index game_expansions_game_id_idx
on public.game_expansions (game_id);

create unique index game_expansions_game_id_name_ci_idx
on public.game_expansions (game_id, lower(btrim(name)));

create trigger z_game_expansions_updated_at
before update on public.game_expansions
for each row execute function private.set_updated_at();

insert into public.game_expansions (
  game_id,
  name,
  is_owned,
  created_at,
  updated_at
)
select
  games.id,
  btrim(games.expansions),
  true,
  games.created_at,
  games.updated_at
from public.games
where games.expansions is not null
  and btrim(games.expansions) <> '';

alter table public.games
drop column expansions;

alter table public.game_expansions enable row level security;

create policy game_expansions_select_members
on public.game_expansions for select to authenticated
using (private.is_active_member());

create policy game_expansions_insert_owner_or_admin
on public.game_expansions for insert to authenticated
with check (
  private.is_active_member()
  and exists (
    select 1
    from public.games as parent
    where parent.id = game_expansions.game_id
      and (private.is_admin() or parent.owner_id = auth.uid())
  )
);

create policy game_expansions_update_owner_or_admin
on public.game_expansions for update to authenticated
using (
  private.is_active_member()
  and exists (
    select 1
    from public.games as parent
    where parent.id = game_expansions.game_id
      and (private.is_admin() or parent.owner_id = auth.uid())
  )
)
with check (
  private.is_active_member()
  and exists (
    select 1
    from public.games as parent
    where parent.id = game_expansions.game_id
      and (private.is_admin() or parent.owner_id = auth.uid())
  )
);

create policy game_expansions_delete_owner_or_admin
on public.game_expansions for delete to authenticated
using (
  private.is_active_member()
  and exists (
    select 1
    from public.games as parent
    where parent.id = game_expansions.game_id
      and (private.is_admin() or parent.owner_id = auth.uid())
  )
);

grant select, insert, update, delete on public.game_expansions to authenticated;

create trigger audit_game_expansions_admin_changes
after insert or update or delete on public.game_expansions
for each row execute function private.audit_admin_change();

create or replace function public.create_game_with_expansions(
  p_title text,
  p_owner_id uuid,
  p_current_holder_id uuid,
  p_cover_url text,
  p_bgg_url text,
  p_bgg_rank integer,
  p_game_type text,
  p_min_players smallint,
  p_max_players smallint,
  p_play_time_minutes integer,
  p_release_year smallint,
  p_mechanics text[],
  p_categories text[],
  p_bgg_weight numeric(3, 2),
  p_min_age smallint,
  p_designer text,
  p_publisher text,
  p_description text,
  p_status public.game_status,
  p_archived_at timestamptz default null,
  p_expansions jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_game_id uuid;
begin
  if jsonb_typeof(coalesce(p_expansions, '[]'::jsonb)) <> 'array' then
    raise exception 'Expansion payload must be a JSON array'
      using errcode = '22023';
  end if;

  insert into public.games (
    title,
    owner_id,
    current_holder_id,
    cover_url,
    bgg_url,
    bgg_rank,
    game_type,
    min_players,
    max_players,
    play_time_minutes,
    release_year,
    mechanics,
    categories,
    bgg_weight,
    min_age,
    designer,
    publisher,
    description,
    status,
    archived_at
  )
  values (
    p_title,
    p_owner_id,
    p_current_holder_id,
    p_cover_url,
    p_bgg_url,
    p_bgg_rank,
    p_game_type,
    p_min_players,
    p_max_players,
    p_play_time_minutes,
    p_release_year,
    coalesce(p_mechanics, '{}'::text[]),
    coalesce(p_categories, '{}'::text[]),
    p_bgg_weight,
    p_min_age,
    p_designer,
    p_publisher,
    p_description,
    p_status,
    p_archived_at
  )
  returning id into created_game_id;

  insert into public.game_expansions (game_id, name, is_owned)
  select
    created_game_id,
    btrim(expansion.name),
    coalesce(expansion.is_owned, false)
  from jsonb_to_recordset(coalesce(p_expansions, '[]'::jsonb)) as expansion(
    name text,
    is_owned boolean
  )
  where btrim(coalesce(expansion.name, '')) <> '';

  return created_game_id;
end;
$$;

create or replace function public.update_game_with_expansions(
  p_game_id uuid,
  p_title text,
  p_owner_id uuid,
  p_current_holder_id uuid,
  p_cover_url text,
  p_bgg_url text,
  p_bgg_rank integer,
  p_game_type text,
  p_min_players smallint,
  p_max_players smallint,
  p_play_time_minutes integer,
  p_release_year smallint,
  p_mechanics text[],
  p_categories text[],
  p_bgg_weight numeric(3, 2),
  p_min_age smallint,
  p_designer text,
  p_publisher text,
  p_description text,
  p_status public.game_status,
  p_expansions jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_game_id uuid;
begin
  if jsonb_typeof(coalesce(p_expansions, '[]'::jsonb)) <> 'array' then
    raise exception 'Expansion payload must be a JSON array'
      using errcode = '22023';
  end if;

  update public.games
  set
    title = p_title,
    owner_id = p_owner_id,
    current_holder_id = p_current_holder_id,
    cover_url = p_cover_url,
    bgg_url = p_bgg_url,
    bgg_rank = p_bgg_rank,
    game_type = p_game_type,
    min_players = p_min_players,
    max_players = p_max_players,
    play_time_minutes = p_play_time_minutes,
    release_year = p_release_year,
    mechanics = coalesce(p_mechanics, '{}'::text[]),
    categories = coalesce(p_categories, '{}'::text[]),
    bgg_weight = p_bgg_weight,
    min_age = p_min_age,
    designer = p_designer,
    publisher = p_publisher,
    description = p_description,
    status = p_status
  where id = p_game_id
  returning id into updated_game_id;

  if updated_game_id is null then
    return null;
  end if;

  delete from public.game_expansions
  where game_id = p_game_id;

  insert into public.game_expansions (game_id, name, is_owned)
  select
    p_game_id,
    btrim(expansion.name),
    coalesce(expansion.is_owned, false)
  from jsonb_to_recordset(coalesce(p_expansions, '[]'::jsonb)) as expansion(
    name text,
    is_owned boolean
  )
  where btrim(coalesce(expansion.name, '')) <> '';

  return updated_game_id;
end;
$$;

revoke all on function public.create_game_with_expansions(
  text,
  uuid,
  uuid,
  text,
  text,
  integer,
  text,
  smallint,
  smallint,
  integer,
  smallint,
  text[],
  text[],
  numeric,
  smallint,
  text,
  text,
  text,
  public.game_status,
  timestamptz,
  jsonb
) from public, anon, authenticated;

revoke all on function public.update_game_with_expansions(
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  integer,
  text,
  smallint,
  smallint,
  integer,
  smallint,
  text[],
  text[],
  numeric,
  smallint,
  text,
  text,
  text,
  public.game_status,
  jsonb
) from public, anon, authenticated;

grant execute on function public.create_game_with_expansions(
  text,
  uuid,
  uuid,
  text,
  text,
  integer,
  text,
  smallint,
  smallint,
  integer,
  smallint,
  text[],
  text[],
  numeric,
  smallint,
  text,
  text,
  text,
  public.game_status,
  timestamptz,
  jsonb
) to authenticated;

grant execute on function public.update_game_with_expansions(
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  integer,
  text,
  smallint,
  smallint,
  integer,
  smallint,
  text[],
  text[],
  numeric,
  smallint,
  text,
  text,
  text,
  public.game_status,
  jsonb
) to authenticated;
