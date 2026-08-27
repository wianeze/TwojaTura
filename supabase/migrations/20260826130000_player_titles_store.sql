-- Pierwszy produkt Sklepu za Tukaty: kosmetyczne tytuły gracza.
-- Renoma i system ramek pozostają nietknięte.

alter table public.profiles
  add column equipped_title_id uuid;

create table public.title_definitions (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug = lower(btrim(slug)) and slug ~ '^[a-z0-9-]+$'),
  name text not null check (length(btrim(name)) > 0),
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  price_tukats integer check (price_tukats is null or price_tukats > 0),
  is_purchasable boolean not null default false,
  is_active boolean not null default true,
  acquisition_kind text not null default 'shop'
    check (acquisition_kind in ('shop', 'achievement', 'mission', 'event', 'admin')),
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint title_definitions_purchase_price_check check (
    not is_purchasable or (acquisition_kind = 'shop' and price_tukats is not null)
  )
);

create table public.user_titles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  title_id uuid not null references public.title_definitions (id) on delete restrict,
  acquired_at timestamptz not null default now(),
  acquisition_kind text not null default 'purchase'
    check (acquisition_kind in ('purchase', 'achievement', 'mission', 'event', 'admin')),
  purchase_request_id uuid unique,
  tukat_event_id uuid unique references public.tukat_events (id) on delete restrict,
  primary key (user_id, title_id),
  constraint user_titles_purchase_event_check check (
    (acquisition_kind = 'purchase' and purchase_request_id is not null and tukat_event_id is not null)
    or acquisition_kind <> 'purchase'
  )
);

alter table public.profiles
  add constraint profiles_equipped_title_id_fkey
  foreign key (equipped_title_id)
  references public.title_definitions (id)
  on delete set null;

create index title_definitions_catalog_idx
  on public.title_definitions (is_active, is_purchasable, sort_order);
create index user_titles_user_acquired_idx
  on public.user_titles (user_id, acquired_at desc);

create trigger title_definitions_updated_at
before update on public.title_definitions
for each row execute function private.set_updated_at();

insert into public.title_definitions (
  id, slug, name, rarity, price_tukats, is_purchasable, is_active, acquisition_kind, sort_order
) values
  ('74000000-0000-4000-8000-000000000001', 'stolowy-wloczega', 'Stołowy Włóczęga', 'common', 50, true, true, 'shop', 10),
  ('74000000-0000-4000-8000-000000000002', 'zbieracz-lupow', 'Zbieracz Łupów', 'common', 50, true, true, 'shop', 20),
  ('74000000-0000-4000-8000-000000000003', 'mistrz-kosci', 'Mistrz Kości', 'rare', 100, true, true, 'shop', 30),
  ('74000000-0000-4000-8000-000000000004', 'kartograf-plansz', 'Kartograf Plansz', 'rare', 150, true, true, 'shop', 40),
  ('74000000-0000-4000-8000-000000000005', 'opowiadacz-legend', 'Opowiadacz Legend', 'rare', 150, true, true, 'shop', 50),
  ('74000000-0000-4000-8000-000000000006', 'wladca-rzutow', 'Władca Rzutów', 'epic', 200, true, true, 'shop', 60),
  ('74000000-0000-4000-8000-000000000007', 'pogromca-pudelek', 'Pogromca Pudełek', 'epic', 250, true, true, 'shop', 70),
  ('74000000-0000-4000-8000-000000000008', 'legenda-stolu', 'Legenda Stołu', 'legendary', 450, true, true, 'shop', 80),
  ('74000000-0000-4000-8000-000000000009', 'wladca-wieczoru', 'Władca Wieczoru', 'legendary', 500, true, true, 'shop', 90);

alter table public.title_definitions enable row level security;
alter table public.user_titles enable row level security;

create policy title_definitions_select_active_members
on public.title_definitions for select to authenticated
using (private.is_active_member() and is_active);

create policy title_definitions_select_admin
on public.title_definitions for select to authenticated
using (private.is_admin());

create policy user_titles_select_own_or_admin
on public.user_titles for select to authenticated
using (user_id = auth.uid() or private.is_admin());

grant select on public.title_definitions, public.user_titles to authenticated;
revoke all on public.title_definitions, public.user_titles from anon;
revoke insert, update, delete on public.title_definitions, public.user_titles from authenticated;

create or replace function public.purchase_title(
  p_title_id uuid,
  p_request_id uuid default extensions.gen_random_uuid()
)
returns table (
  title_id uuid,
  title_name text,
  price_tukats integer,
  balance_after bigint,
  purchased_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_title public.title_definitions%rowtype;
  v_existing public.user_titles%rowtype;
  v_event_id uuid := extensions.gen_random_uuid();
  v_balance bigint;
  v_now timestamptz := now();
begin
  if v_user_id is null or not private.is_gamification_eligible(v_user_id) then
    raise exception 'An active player membership is required' using errcode = '42501';
  end if;
  if p_title_id is null or p_request_id is null then
    raise exception 'Title and request id are required' using errcode = '22023';
  end if;
  -- Wszystkie zakupy jednego gracza serializujemy PRZED odczytem requestu.
  -- Dzięki temu równoległy retry widzi już pierwszy zapis i zwraca ten sam wynik.
  perform pg_advisory_xact_lock(hashtext('title_purchase:' || v_user_id::text));

  select * into v_existing from public.user_titles where purchase_request_id = p_request_id;
  if found then
    if v_existing.user_id <> v_user_id or v_existing.title_id <> p_title_id then
      raise exception 'Request id has already been used for another title purchase' using errcode = '23505';
    end if;
    return query
    select definition.id, definition.name, definition.price_tukats,
      coalesce((select sum(event.amount) from public.tukat_events event where event.user_id = v_user_id), 0)::bigint,
      v_existing.acquired_at
    from public.title_definitions definition where definition.id = v_existing.title_id;
    return;
  end if;

  select * into v_title from public.title_definitions
  where id = p_title_id and is_active and is_purchasable and acquisition_kind = 'shop';
  if not found then
    raise exception 'Title is not available for purchase' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.user_titles as owned
    where owned.user_id = v_user_id and owned.title_id = p_title_id
  ) then
    raise exception 'Title is already owned' using errcode = '23505';
  end if;

  select coalesce(sum(amount), 0)::bigint into v_balance
  from public.tukat_events where user_id = v_user_id;
  if v_balance < v_title.price_tukats then
    raise exception 'Insufficient Tukats' using errcode = '23514';
  end if;

  insert into public.tukat_events (id, user_id, amount, source_type, source_id, reason, idempotency_key, created_at)
  values (
    v_event_id, v_user_id, -v_title.price_tukats, 'title_purchase', v_title.id,
    'Zakup tytułu: ' || v_title.name,
    'title_purchase:' || v_user_id::text || ':' || p_request_id::text,
    v_now
  );

  insert into public.user_titles (user_id, title_id, acquired_at, acquisition_kind, purchase_request_id, tukat_event_id)
  values (v_user_id, v_title.id, v_now, 'purchase', p_request_id, v_event_id);

  return query select v_title.id, v_title.name, v_title.price_tukats, v_balance - v_title.price_tukats, v_now;
end;
$$;

create or replace function public.set_equipped_title(p_title_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not private.is_active_member(v_user_id) then
    raise exception 'Active membership is required' using errcode = '42501';
  end if;
  if p_title_id is not null and not exists (
    select 1 from public.user_titles as owned
    where owned.user_id = v_user_id and owned.title_id = p_title_id
  ) then
    raise exception 'Title is not owned' using errcode = '42501';
  end if;
  update public.profiles set equipped_title_id = p_title_id where id = v_user_id;
  return p_title_id;
end;
$$;

revoke all on function public.purchase_title(uuid, uuid), public.set_equipped_title(uuid)
from public, anon;
grant execute on function public.purchase_title(uuid, uuid), public.set_equipped_title(uuid)
to authenticated;

-- Jedna jawna, bezpieczna projekcja dla rankingów. Dzięki niej Tytuł nie
-- wymaga odczytu emaila ani pełnego profilu drugiego gracza.
drop function public.get_public_player_profiles();
create function public.get_public_player_profiles()
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  active_class_key text,
  active_portrait_frame_key text,
  equipped_title_id uuid,
  equipped_title_name text,
  equipped_title_rarity text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id,
    profile.display_name,
    profile.avatar_url,
    profile.active_class_key,
    profile.active_portrait_frame_key,
    profile.equipped_title_id,
    title.name,
    title.rarity
  from public.profiles as profile
  left join public.title_definitions as title on title.id = profile.equipped_title_id
  where private.is_active_member(auth.uid())
    and (
      private.is_public_gamification_visible(profile.id)
      or profile.id = auth.uid()
    );
$$;
revoke all on function public.get_public_player_profiles() from public, anon, authenticated;
grant execute on function public.get_public_player_profiles() to authenticated;

comment on table public.title_definitions is
  'Katalog kosmetycznych tytułów. acquisition_kind zostawia miejsce na przyszłe tytuły achievementowe, misyjne i sezonowe.';
comment on table public.user_titles is
  'Ekwipunek tytułów użytkownika. Zakupy mają własny event Tukatów i request id dla idempotencji.';
