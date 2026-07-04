create table public.games (
  id uuid primary key default extensions.gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  current_holder_id uuid references public.profiles (id) on delete set null,
  cover_url text,
  bgg_url text,
  bgg_rank integer check (bgg_rank > 0),
  game_type text,
  min_players smallint check (min_players > 0),
  max_players smallint check (max_players > 0),
  play_time_minutes integer check (play_time_minutes > 0),
  release_year smallint check (release_year between 1900 and 2100),
  mechanics text[] not null default '{}',
  categories text[] not null default '{}',
  bgg_weight numeric(3, 2) check (bgg_weight between 1 and 5),
  min_age smallint check (min_age >= 0),
  designer text,
  publisher text,
  expansions text,
  description text,
  status public.game_status not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint games_player_range_check check (
    min_players is null
    or max_players is null
    or min_players <= max_players
  )
);

create table public.ratings (
  id uuid primary key default extensions.gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  overall smallint not null check (overall between 1 and 10),
  replayability smallint not null check (replayability between 1 and 10),
  theme smallint not null check (theme between 1 and 10),
  wants_to_play_again boolean not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ratings_game_user_key unique (game_id, user_id)
);

create index games_owner_id_idx on public.games (owner_id);
create index games_current_holder_id_idx on public.games (current_holder_id);
create index games_created_at_idx on public.games (created_at desc);
create index games_lower_title_idx on public.games (lower(title));
create index games_mechanics_idx on public.games using gin (mechanics);
create index games_categories_idx on public.games using gin (categories);
create index ratings_game_id_idx on public.ratings (game_id);

