create table public.meetings (
  id uuid primary key default extensions.gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  title text not null check (length(btrim(title)) > 0),
  description text,
  location text,
  status public.meeting_status not null default 'planned',
  selected_option_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meeting_options (
  id uuid primary key default extensions.gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  label text,
  created_at timestamptz not null default now(),
  constraint meeting_options_time_check check (
    ends_at is null or ends_at > starts_at
  ),
  constraint meeting_options_meeting_start_key unique (meeting_id, starts_at),
  constraint meeting_options_meeting_id_id_key unique (meeting_id, id)
);

alter table public.meetings
  add constraint meetings_selected_option_same_meeting_fk
  foreign key (id, selected_option_id)
  references public.meeting_options (meeting_id, id)
  deferrable initially immediate;

create table public.meeting_availability (
  meeting_option_id uuid not null references public.meeting_options (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  is_available boolean not null,
  updated_at timestamptz not null default now(),
  primary key (meeting_option_id, user_id)
);

create table public.meeting_game_votes (
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meeting_id, game_id, user_id)
);

create index meetings_status_idx on public.meetings (status);
create index meeting_options_meeting_starts_idx
  on public.meeting_options (meeting_id, starts_at);
create index meeting_availability_user_id_idx
  on public.meeting_availability (user_id);
create index meeting_game_votes_meeting_game_idx
  on public.meeting_game_votes (meeting_id, game_id);

