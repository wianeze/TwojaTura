create table public.plays (
  id uuid primary key default extensions.gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete restrict,
  meeting_id uuid references public.meetings (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  played_at timestamptz not null,
  duration_minutes integer check (duration_minutes > 0),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.play_participants (
  play_id uuid not null references public.plays (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  placement smallint check (placement > 0),
  score numeric(12, 2),
  is_winner boolean not null default false,
  primary key (play_id, user_id)
);

create table public.point_events (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  points integer not null check (points <> 0),
  action_type text not null check (length(btrim(action_type)) > 0),
  description text,
  related_entity_type text,
  related_entity_id uuid,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint point_events_related_entity_pair_check check (
    (related_entity_type is null and related_entity_id is null)
    or (related_entity_type is not null and related_entity_id is not null)
  )
);

create table public.audit_log (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid not null references public.profiles (id) on delete restrict,
  action text not null check (length(btrim(action)) > 0),
  entity_type text not null check (length(btrim(entity_type)) > 0),
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index plays_played_at_idx on public.plays (played_at desc);
create index plays_game_id_idx on public.plays (game_id);
create index plays_meeting_id_idx on public.plays (meeting_id);
create index play_participants_user_id_idx
  on public.play_participants (user_id);
create index point_events_user_created_idx
  on public.point_events (user_id, created_at desc);
create index point_events_action_type_idx
  on public.point_events (action_type);
create index point_events_related_entity_idx
  on public.point_events (related_entity_type, related_entity_id)
  where related_entity_type is not null and related_entity_id is not null;
create index audit_log_created_at_idx on public.audit_log (created_at desc);
create index audit_log_actor_created_idx
  on public.audit_log (actor_user_id, created_at desc);
create index audit_log_entity_idx
  on public.audit_log (entity_type, entity_id);

