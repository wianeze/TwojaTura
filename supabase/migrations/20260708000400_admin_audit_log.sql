-- Etap D4: audit trail for /admin panel actions (role changes, account
-- deactivation/anonymization). Append-only from the application's point of
-- view — the only writer is the SECURITY DEFINER RPCs in the next
-- migration, never a direct client insert.

create table public.admin_audit_log (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid not null references public.profiles (id) on delete restrict,
  target_user_id uuid references public.profiles (id) on delete set null,
  action_type text not null check (length(btrim(action_type)) > 0),
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index admin_audit_log_target_user_id_idx
  on public.admin_audit_log (target_user_id);
create index admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

create policy admin_audit_log_select_admin
on public.admin_audit_log for select to authenticated
using (private.is_admin());

-- No insert/update/delete policy for `authenticated` — rows are written
-- exclusively by SECURITY DEFINER RPCs (which run as the function owner,
-- bypassing RLS), matching the existing public.audit_log pattern.
create trigger admin_audit_log_append_only
before update or delete on public.admin_audit_log
for each row execute function private.prevent_append_only_mutation();

grant select on public.admin_audit_log to authenticated;
