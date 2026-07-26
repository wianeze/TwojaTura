-- "Zgłoś poprawkę": compact user-submitted improvement suggestions, visible
-- only to their author and to admins. Deliberately outside the
-- gamification/audit systems — no point_events, no user_achievements, no
-- admin_audit_log entries for this table (agreed 2026-07-26 plan).

create type public.feedback_status as enum ('new', 'in_progress', 'completed', 'rejected');

create table public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content text not null check (length(btrim(content)) > 0 and length(content) <= 1000),
  status public.feedback_status not null default 'new',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Listing/filtering in the admin panel (newest first, optionally by status).
create index feedback_submissions_status_created_idx
  on public.feedback_submissions (status, created_at desc);

-- Cooldown lookup ("has this author submitted in the last 60s?") and the
-- author's own-row RLS policy.
create index feedback_submissions_author_created_idx
  on public.feedback_submissions (author_id, created_at desc);

alter table public.feedback_submissions enable row level security;

create trigger z_feedback_submissions_updated_at
before update on public.feedback_submissions
for each row execute function private.set_updated_at();

-- One submission per author per 60 seconds, enforced in the database so it
-- can't be bypassed by calling the table directly instead of the Server
-- Action. security definer: needs to see every author's rows regardless of
-- whose row is currently being inserted, independent of RLS.
create or replace function private.enforce_feedback_cooldown()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.feedback_submissions as existing
    where existing.author_id = new.author_id
      and existing.created_at > now() - interval '60 seconds'
  ) then
    raise exception 'Kolejne zgłoszenie możesz wysłać za chwilę.' using errcode = 'P0003';
  end if;

  return new;
end;
$$;

create trigger a_feedback_submissions_enforce_cooldown
before insert on public.feedback_submissions
for each row execute function private.enforce_feedback_cooldown();

revoke all on function private.enforce_feedback_cooldown() from public, anon, authenticated;

-- Any active member (including observer — feedback about the app is not a
-- domain-data mutation, unlike plays/ratings/etc. where observers are
-- read-only) may submit. author_id/status can't be spoofed: the column
-- grant below only allows an INSERT to specify `content`, so author_id
-- falls through to its default (auth.uid()) and status to 'new' — the RLS
-- check is defense in depth on top of that, not the only guard.
create policy feedback_submissions_insert_self
on public.feedback_submissions for insert to authenticated
with check (
  private.is_active_member()
  and author_id = auth.uid()
  and status = 'new'
);

-- Only the author can read their own row directly, and only the safe
-- columns (see the column grant below — admin_note is excluded from it, so
-- it never becomes visible to a non-admin even for their own row). No
-- separate admin SELECT policy: the admin panel reads through
-- admin_list_feedback_submissions() instead, a security definer function
-- that is not bound by this table's column grants and can safely return
-- admin_note alongside every author's content.
create policy feedback_submissions_select_own
on public.feedback_submissions for select to authenticated
using (private.is_active_member() and author_id = auth.uid());

-- No update/delete policy for `authenticated` at all: nobody can edit their
-- own submission after sending it, and admin status/note changes go
-- exclusively through admin_update_feedback_submission() (security
-- definer), not a direct RLS-gated UPDATE — kept to one unambiguous write
-- path for the columns that must stay invisible to non-admins.

grant select (content, status, created_at) on public.feedback_submissions to authenticated;
grant insert (content) on public.feedback_submissions to authenticated;

create or replace function public.admin_list_feedback_submissions(
  p_status_filter public.feedback_status default null
)
returns table (
  id uuid,
  author_display_name text,
  content text,
  status public.feedback_status,
  admin_note text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  return query
  select
    f.id,
    p.display_name,
    f.content,
    f.status,
    f.admin_note,
    f.created_at
  from public.feedback_submissions as f
  join public.profiles as p on p.id = f.author_id
  where p_status_filter is null or f.status = p_status_filter
  order by f.created_at desc;
end;
$$;

create or replace function public.admin_update_feedback_submission(
  p_id uuid,
  p_status public.feedback_status,
  p_admin_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  update public.feedback_submissions
  set status = p_status,
      admin_note = nullif(btrim(p_admin_note), '')
  where id = p_id;

  if not found then
    raise exception 'Feedback submission not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_list_feedback_submissions(public.feedback_status)
  from public, anon, authenticated;
grant execute on function public.admin_list_feedback_submissions(public.feedback_status)
  to authenticated;

revoke all on function public.admin_update_feedback_submission(uuid, public.feedback_status, text)
  from public, anon, authenticated;
grant execute on function public.admin_update_feedback_submission(uuid, public.feedback_status, text)
  to authenticated;
