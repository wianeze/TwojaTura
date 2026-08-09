-- Cosmetic portrait-frame catalog, inventory and point-ledger purchases.
-- Common frames are available to every active member without inventory rows.

create table public.portrait_frames (
  id uuid primary key default extensions.gen_random_uuid(),
  frame_key text not null unique check (length(btrim(frame_key)) > 0),
  name text not null check (length(btrim(name)) > 0),
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  asset_path text not null check (asset_path like '/Frames/%.png'),
  price_points integer not null default 0 check (price_points >= 0),
  is_shop_available boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portrait_frames_shop_price_check check (
    not is_shop_available or (rarity <> 'common' and price_points > 0)
  )
);

create table public.user_portrait_frames (
  user_id uuid not null references public.profiles (id) on delete cascade,
  frame_id uuid not null references public.portrait_frames (id) on delete restrict,
  acquired_at timestamptz not null default now(),
  acquisition_type text not null default 'purchase'
    check (acquisition_type in ('purchase', 'admin')),
  primary key (user_id, frame_id)
);

alter table public.profiles
  add column active_portrait_frame_key text
    references public.portrait_frames (frame_key) on delete set null;

create index portrait_frames_catalog_idx
  on public.portrait_frames (is_active, rarity, sort_order);
create index user_portrait_frames_user_acquired_idx
  on public.user_portrait_frames (user_id, acquired_at desc);
create index user_portrait_frames_frame_idx
  on public.user_portrait_frames (frame_id);

create trigger portrait_frames_updated_at
before update on public.portrait_frames
for each row execute function private.set_updated_at();

insert into public.portrait_frames (
  id, frame_key, name, rarity, asset_path, price_points,
  is_shop_available, sort_order
) values
  ('71000000-0000-4000-8000-000000000001', 'common-frame-1', 'Srebrna Sowa', 'common', '/Frames/common-frame-1-dopasowanie.png', 0, false, 10),
  ('71000000-0000-4000-8000-000000000002', 'common-frame-2', 'Leśny Znak', 'common', '/Frames/common-frame-2-dopasowanie.png', 0, false, 20),
  ('71000000-0000-4000-8000-000000000003', 'common-frame-3', 'Strażnik Półki', 'common', '/Frames/common-frame-3.png', 0, false, 30),
  ('71000000-0000-4000-8000-000000000004', 'common-frame-4', 'Wędrowny Gracz', 'common', '/Frames/common-frame-4.png', 0, false, 40),
  ('71000000-0000-4000-8000-000000000005', 'common-frame-5', 'Znak Drużyny', 'common', '/Frames/common-frame-5.png', 0, false, 50),
  ('72000000-0000-4000-8000-000000000001', 'magic-frame-1', 'Błękitna Runa', 'rare', '/Frames/magic-frame-1.png', 500, true, 110),
  ('72000000-0000-4000-8000-000000000002', 'magic-frame-2', 'Zaklęty Kryształ', 'rare', '/Frames/magic-frame-2.png', 600, true, 120),
  ('72000000-0000-4000-8000-000000000003', 'magic-frame-3', 'Arkana Stołu', 'rare', '/Frames/magic-frame-3.png', 700, true, 130),
  ('72000000-0000-4000-8000-000000000004', 'magic-frame-4', 'Pieczęć Magii', 'rare', '/Frames/magic-frame-4.png', 800, true, 140),
  ('73000000-0000-4000-8000-000000000001', 'epic-frame-1', 'Purpurowy Tron', 'epic', '/Frames/epic-frame-1.png', 1200, true, 210),
  ('73000000-0000-4000-8000-000000000002', 'epic-frame-2', 'Korona Bohatera', 'epic', '/Frames/epic-frame-2.png', 1400, true, 220),
  ('73000000-0000-4000-8000-000000000003', 'epic-frame-3', 'Relikt Legend', 'epic', '/Frames/epic-frame-3.png', 1600, true, 230),
  ('73000000-0000-4000-8000-000000000004', 'epic-frame-4', 'Brama Przeznaczenia', 'epic', '/Frames/epic-frame-4.png', 1800, true, 240);

alter table public.portrait_frames enable row level security;
alter table public.user_portrait_frames enable row level security;

create policy portrait_frames_select_active_members
on public.portrait_frames for select to authenticated
using (private.is_active_member() and is_active);

create policy portrait_frames_select_admin
on public.portrait_frames for select to authenticated
using (private.is_admin());

create policy user_portrait_frames_select_own
on public.user_portrait_frames for select to authenticated
using (private.is_active_member() and user_id = auth.uid());

create policy user_portrait_frames_select_admin
on public.user_portrait_frames for select to authenticated
using (private.is_admin());

grant select on public.portrait_frames to authenticated;
grant select on public.user_portrait_frames to authenticated;

create or replace function public.set_active_portrait_frame(p_frame_key text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_frame public.portrait_frames%rowtype;
begin
  if v_user_id is null or not private.is_active_member(v_user_id) then
    raise exception 'Active membership is required' using errcode = '42501';
  end if;

  select frame.* into v_frame
  from public.portrait_frames as frame
  where frame.frame_key = btrim(p_frame_key)
    and frame.is_active;

  if not found then
    raise exception 'Portrait frame does not exist' using errcode = 'P0002';
  end if;

  if v_frame.rarity <> 'common' and not exists (
    select 1 from public.user_portrait_frames as owned
    where owned.user_id = v_user_id and owned.frame_id = v_frame.id
  ) then
    raise exception 'Portrait frame is not owned' using errcode = '42501';
  end if;

  update public.profiles
  set active_portrait_frame_key = v_frame.frame_key
  where id = v_user_id;

  return v_frame.frame_key;
end;
$$;

revoke all on function public.set_active_portrait_frame(text)
  from public, anon, authenticated;
grant execute on function public.set_active_portrait_frame(text) to authenticated;
