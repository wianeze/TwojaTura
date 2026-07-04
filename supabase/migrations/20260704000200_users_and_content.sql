create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) > 0),
  email text not null unique check (length(btrim(email)) > 0),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_members (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role public.membership_role not null default 'member',
  is_active boolean not null default true,
  joined_at timestamptz not null default now()
);

create table public.app_content (
  content_key text primary key check (length(btrim(content_key)) > 0),
  value text not null check (length(btrim(value)) > 0),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index app_content_updated_at_idx
  on public.app_content (updated_at desc);

