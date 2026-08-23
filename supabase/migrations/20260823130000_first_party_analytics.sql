-- First-party analytics MVP: security audit + product usage events.
-- No client-readable telemetry, no direct table inserts and no advertising
-- identifiers. All timestamps are authoritative database timestamps.

create table public.audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  event_type text not null check (event_type in (
    'auth.login.success',
    'auth.login.failure',
    'auth.logout',
    'auth.password_reset.requested',
    'auth.password.changed',
    'server_action.error'
  )),
  actor_user_id uuid references public.profiles (id) on delete set null,
  status text not null check (status in ('success', 'failure', 'denied', 'error')),
  route_key text check (
    route_key is null or route_key in (
      'login', 'table', 'shelf', 'legendarium', 'calendar', 'chronicle',
      'profile', 'admin', 'admin.statistics', 'password'
    )
  ),
  device_class text check (
    device_class is null or device_class in ('mobile', 'tablet', 'desktop', 'unknown')
  ),
  browser_family text check (
    browser_family is null or browser_family in ('Chrome', 'Safari', 'Firefox', 'Edge', 'Other')
  ),
  request_id uuid,
  idempotency_key text check (
    idempotency_key is null or (
      length(idempotency_key) between 1 and 160
      and idempotency_key ~ '^[a-zA-Z0-9_.:-]+$'
    )
  ),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and pg_column_size(metadata) <= 2048
  ),
  created_at timestamptz not null default statement_timestamp()
);

create unique index audit_events_idempotency_key_idx
  on public.audit_events (idempotency_key)
  where idempotency_key is not null;
create index audit_events_created_at_idx
  on public.audit_events (created_at desc);
create index audit_events_type_created_at_idx
  on public.audit_events (event_type, created_at desc);
create index audit_events_actor_created_at_idx
  on public.audit_events (actor_user_id, created_at desc);

create table public.usage_events (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_name text not null check (event_name in (
    'route.viewed',
    'quest.presented',
    'quest.clicked',
    'quest.completed',
    'meeting.created',
    'meeting.rsvp.submitted',
    'meeting.vote.submitted',
    'meeting.game.proposed',
    'meeting.continuation.proposed',
    'meeting.table.opened',
    'meeting.play.resumed',
    'meeting.play.paused',
    'meeting.play.finished',
    'game.opened',
    'game.added',
    'play.created',
    'rating.submitted',
    'class.changed',
    'achievement.viewed'
  )),
  route_key text check (
    route_key is null or route_key in (
      'table', 'shelf', 'legendarium', 'calendar', 'chronicle',
      'profile', 'admin', 'admin.statistics'
    )
  ),
  component_key text check (
    component_key is null or component_key in (
      'app.route',
      'dashboard.quest',
      'meeting.form',
      'meeting.rsvp',
      'meeting.vote',
      'meeting.game_proposal',
      'meeting.continuation',
      'meeting.table',
      'game.card',
      'game.form',
      'play.form',
      'rating.form',
      'profile.class',
      'legendarium.achievement'
    )
  ),
  action text check (
    action is null or action in (
      'viewed', 'presented', 'clicked', 'completed', 'created', 'submitted',
      'proposed', 'opened', 'resumed', 'paused', 'finished', 'added', 'changed'
    )
  ),
  entity_type text check (
    entity_type is null or entity_type in ('meeting', 'game', 'play', 'quest', 'class', 'achievement')
  ),
  entity_id uuid,
  correlation_key text check (
    correlation_key is null or (
      length(correlation_key) between 1 and 180
      and correlation_key ~ '^[a-zA-Z0-9_.:-]+$'
    )
  ),
  source text not null check (source in ('client', 'server')),
  app_version text check (app_version is null or length(app_version) <= 80),
  device_class text check (
    device_class is null or device_class in ('mobile', 'tablet', 'desktop', 'unknown')
  ),
  browser_family text check (
    browser_family is null or browser_family in ('Chrome', 'Safari', 'Firefox', 'Edge', 'Other')
  ),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and pg_column_size(metadata) <= 2048
  ),
  created_at timestamptz not null default statement_timestamp()
);

create index usage_events_created_at_idx
  on public.usage_events (created_at desc);
create index usage_events_name_created_at_idx
  on public.usage_events (event_name, created_at desc);
create index usage_events_user_created_at_idx
  on public.usage_events (user_id, created_at desc);
create index usage_events_route_created_at_idx
  on public.usage_events (route_key, created_at desc)
  where route_key is not null;
create index usage_events_component_created_at_idx
  on public.usage_events (component_key, created_at desc)
  where component_key is not null;

alter table public.audit_events enable row level security;
alter table public.usage_events enable row level security;

create policy audit_events_select_admin
on public.audit_events for select to authenticated
using (private.is_admin());

create policy usage_events_select_admin
on public.usage_events for select to authenticated
using (private.is_admin());

grant select on public.audit_events to authenticated;
grant select on public.usage_events to authenticated;

create or replace function private.prevent_analytics_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    and current_setting('app.analytics_retention', true) = 'on' then
    return old;
  end if;

  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;

create trigger audit_events_append_only
before update or delete on public.audit_events
for each row execute function private.prevent_analytics_event_mutation();

create trigger usage_events_append_only
before update or delete on public.usage_events
for each row execute function private.prevent_analytics_event_mutation();

create or replace function private.analytics_metadata_allowed(
  p_event_name text,
  p_metadata jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object'
    and pg_column_size(coalesce(p_metadata, '{}'::jsonb)) <= 2048
    and not exists (
      select 1
      from jsonb_object_keys(coalesce(p_metadata, '{}'::jsonb)) as supplied(key)
      where supplied.key <> all (
        case
          when p_event_name like 'quest.%' then
            array['quest_type', 'expires_at', 'meeting_id', 'game_id', 'play_id']::text[]
          when p_event_name like 'meeting.%' then
            array['meeting_id', 'game_id', 'play_id']::text[]
          when p_event_name in ('play.created', 'rating.submitted') then
            array['meeting_id', 'game_id', 'play_id']::text[]
          when p_event_name in ('game.opened', 'game.added') then
            array['game_id']::text[]
          when p_event_name = 'class.changed' then
            array['class_key']::text[]
          when p_event_name = 'achievement.viewed' then
            array['achievement_key']::text[]
          else array[]::text[]
        end
      )
    )
    and not exists (
      select 1
      from jsonb_each(coalesce(p_metadata, '{}'::jsonb)) as supplied(key, value)
      where jsonb_typeof(supplied.value) <> 'string'
        or length(supplied.value #>> '{}') > 180
        or (
          supplied.key in ('meeting_id', 'game_id', 'play_id')
          and (supplied.value #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        )
        or (
          supplied.key = 'expires_at'
          and (supplied.value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}T'
        )
        or (
          supplied.key not in ('meeting_id', 'game_id', 'play_id', 'expires_at')
          and (supplied.value #>> '{}') !~ '^[a-zA-Z0-9_.:-]+$'
        )
    );
$$;

create or replace function private.audit_metadata_allowed(
  p_event_type text,
  p_metadata jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object'
    and pg_column_size(coalesce(p_metadata, '{}'::jsonb)) <= 2048
    and not exists (
      select 1
      from jsonb_object_keys(coalesce(p_metadata, '{}'::jsonb)) as supplied(key)
      where supplied.key <> all (
        case
          when p_event_type = 'server_action.error' then
            array['error_action', 'error_code']::text[]
          else array[]::text[]
        end
      )
    )
    and not exists (
      select 1
      from jsonb_each(coalesce(p_metadata, '{}'::jsonb)) as supplied(key, value)
      where jsonb_typeof(supplied.value) <> 'string'
        or length(supplied.value #>> '{}') > 80
        or (supplied.value #>> '{}') !~ '^[a-zA-Z0-9_.:-]+$'
    );
$$;

create or replace function public.record_usage_event(
  p_event_id uuid,
  p_event_name text,
  p_route_key text default null,
  p_component_key text default null,
  p_action text default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_correlation_key text default null,
  p_source text default 'server',
  p_app_version text default null,
  p_device_class text default null,
  p_browser_family text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if auth.uid() is null or not private.is_active_member(auth.uid()) then
    raise exception 'Active membership is required' using errcode = '42501';
  end if;

  if not private.analytics_metadata_allowed(p_event_name, p_metadata) then
    raise exception 'Unsupported analytics metadata' using errcode = '22023';
  end if;

  insert into public.usage_events (
    id, user_id, event_name, route_key, component_key, action,
    entity_type, entity_id, correlation_key, source, app_version,
    device_class, browser_family, metadata
  ) values (
    p_event_id, auth.uid(), p_event_name, p_route_key, p_component_key, p_action,
    p_entity_type, p_entity_id, p_correlation_key, p_source, p_app_version,
    p_device_class, p_browser_family, coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;

create or replace function public.record_audit_event(
  p_event_id uuid,
  p_event_type text,
  p_status text,
  p_route_key text default null,
  p_device_class text default null,
  p_browser_family text default null,
  p_request_id uuid default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if auth.uid() is null or not private.is_active_member(auth.uid()) then
    raise exception 'Active membership is required' using errcode = '42501';
  end if;

  if not private.audit_metadata_allowed(p_event_type, p_metadata) then
    raise exception 'Unsupported audit metadata' using errcode = '22023';
  end if;

  insert into public.audit_events (
    id, event_type, actor_user_id, status, route_key, device_class,
    browser_family, request_id, idempotency_key, metadata
  ) values (
    p_event_id, p_event_type, auth.uid(), p_status, p_route_key, p_device_class,
    p_browser_family, p_request_id, p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;

create or replace function public.admin_analytics_snapshot(
  p_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  days_count integer := greatest(1, least(coalesce(p_days, 30), 90));
  range_start timestamptz := date_trunc('day', statement_timestamp()) -
    make_interval(days => greatest(1, least(coalesce(p_days, 30), 90)) - 1);
  result jsonb;
begin
  if not private.is_admin(auth.uid()) then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  with
  usage as (
    select * from public.usage_events where created_at >= range_start
  ),
  audit as (
    select * from public.audit_events where created_at >= range_start
  ),
  daily as (
    select
      day::date as metric_date,
      count(u.id)::integer as events_count,
      count(distinct u.user_id)::integer as active_users
    from generate_series(
      date_trunc('day', range_start),
      date_trunc('day', statement_timestamp()),
      interval '1 day'
    ) as day
    left join usage u
      on u.created_at >= day and u.created_at < day + interval '1 day'
    group by day
    order by day
  ),
  route_stats as (
    select route_key, count(*)::integer as events_count,
      count(distinct user_id)::integer as unique_users
    from usage
    where event_name = 'route.viewed' and route_key is not null
    group by route_key
    order by events_count desc, route_key
  ),
  component_stats as (
    select component_key, action, count(*)::integer as events_count,
      count(distinct user_id)::integer as unique_users
    from usage
    where component_key is not null
    group by component_key, action
    order by events_count desc, component_key
    limit 20
  ),
  login_users as (
    select
      p.id as user_id,
      p.display_name,
      count(*) filter (where a.event_type = 'auth.login.success')::integer as login_count,
      max(a.created_at) filter (where a.event_type = 'auth.login.success') as last_login_at
    from public.profiles p
    left join audit a on a.actor_user_id = p.id
    group by p.id, p.display_name
  ),
  user_last_activity as (
    select user_id, max(created_at) as last_activity_at
    from public.usage_events
    group by user_id
  ),
  funnel_names(stage, event_name, position) as (
    values
      ('Utworzenie', 'meeting.created', 1),
      ('RSVP', 'meeting.rsvp.submitted', 2),
      ('Głos', 'meeting.vote.submitted', 3),
      ('Stół', 'meeting.table.opened', 4),
      ('Zakończenie / odłożenie', 'meeting.play.finished', 5),
      ('Kronika', 'play.created', 6),
      ('Ocena', 'rating.submitted', 7)
  ),
  funnel as (
    select f.stage, f.position,
      count(distinct coalesce(u.metadata ->> 'meeting_id', u.entity_id::text))::integer as events_count
    from funnel_names f
    left join usage u on u.event_name = f.event_name
    group by f.stage, f.position
    order by f.position
  ),
  continuation_names(stage, event_name, position) as (
    values
      ('Zaproponowano', 'meeting.continuation.proposed', 1),
      ('Wznowiono', 'meeting.play.resumed', 2),
      ('Odłożono', 'meeting.play.paused', 3),
      ('Zakończono', 'meeting.play.finished', 4)
  ),
  continuations as (
    select c.stage, c.position, count(u.id)::integer as events_count
    from continuation_names c
    left join usage u on u.event_name = c.event_name
    group by c.stage, c.position
    order by c.position
  )
  select jsonb_build_object(
    'range_days', days_count,
    'generated_at', statement_timestamp(),
    'kpis', jsonb_build_object(
      'active_today', (select count(distinct user_id) from public.usage_events where created_at >= date_trunc('day', statement_timestamp())),
      'active_7_days', (select count(distinct user_id) from public.usage_events where created_at >= statement_timestamp() - interval '7 days'),
      'active_30_days', (select count(distinct user_id) from public.usage_events where created_at >= statement_timestamp() - interval '30 days'),
      'login_success', (select count(*) from audit where event_type = 'auth.login.success'),
      'login_failure', (select count(*) from audit where event_type = 'auth.login.failure'),
      'action_errors', (select count(*) from audit where event_type = 'server_action.error')
    ),
    'daily_activity', coalesce((select jsonb_agg(to_jsonb(daily) order by metric_date) from daily), '[]'::jsonb),
    'routes', coalesce((select jsonb_agg(to_jsonb(route_stats)) from route_stats), '[]'::jsonb),
    'top_components', coalesce((select jsonb_agg(to_jsonb(component_stats)) from component_stats), '[]'::jsonb),
    'quest_usage', jsonb_build_object(
      'presented', (select count(*) from usage where event_name = 'quest.presented'),
      'clicked', (select count(*) from usage where event_name = 'quest.clicked'),
      'completed', (select count(*) from usage where event_name = 'quest.completed'),
      'expired', (
        select count(*) from usage
        where event_name = 'quest.presented'
          and nullif(metadata ->> 'expires_at', '')::timestamptz < statement_timestamp()
      )
    ),
    'funnel', coalesce((select jsonb_agg(to_jsonb(funnel) order by position) from funnel), '[]'::jsonb),
    'continuations', coalesce((select jsonb_agg(to_jsonb(continuations) order by position) from continuations), '[]'::jsonb),
    'recent_logins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'display_name', p.display_name,
        'created_at', a.created_at,
        'device_class', a.device_class,
        'browser_family', a.browser_family,
        'status', a.status
      ) order by a.created_at desc)
      from (select * from audit where event_type in ('auth.login.success', 'auth.login.failure') order by created_at desc limit 20) a
      left join public.profiles p on p.id = a.actor_user_id
    ), '[]'::jsonb),
    'user_activity', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', l.user_id,
        'display_name', l.display_name,
        'login_count', l.login_count,
        'last_login_at', l.last_login_at,
        'last_activity_at', ula.last_activity_at
      ) order by coalesce(ula.last_activity_at, l.last_login_at) desc nulls last)
      from login_users l
      left join user_last_activity ula on ula.user_id = l.user_id
    ), '[]'::jsonb),
    'errors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'created_at', e.created_at,
        'display_name', p.display_name,
        'error_action', e.metadata ->> 'error_action',
        'error_code', e.metadata ->> 'error_code'
      ) order by e.created_at desc)
      from (select * from audit where event_type = 'server_action.error' order by created_at desc limit 20) e
      left join public.profiles p on p.id = e.actor_user_id
    ), '[]'::jsonb),
    'continued_games', coalesce((
      select jsonb_agg(jsonb_build_object(
        'game_id', g.id,
        'title', g.title,
        'events_count', grouped.events_count
      ) order by grouped.events_count desc, g.title)
      from (
        select p.game_id, count(*)::integer as events_count
        from usage u
        join public.plays p
          on u.entity_type = 'play' and p.id = u.entity_id
        where u.event_name in ('meeting.continuation.proposed', 'meeting.play.resumed')
        group by p.game_id
        limit 10
      ) grouped
      join public.games g on g.id = grouped.game_id
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- Raw-event retention. The function is intentionally private and not
-- scheduled here; production can invoke it from the existing scheduler.
create or replace function private.purge_expired_analytics_events()
returns table (usage_deleted bigint, audit_deleted bigint, admin_audit_deleted bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform set_config('app.analytics_retention', 'on', true);

  delete from public.usage_events
  where created_at < statement_timestamp() - interval '90 days';
  get diagnostics usage_deleted = row_count;

  delete from public.audit_events
  where created_at < statement_timestamp() - interval '180 days';
  get diagnostics audit_deleted = row_count;

  delete from public.admin_audit_log
  where created_at < statement_timestamp() - interval '24 months';
  get diagnostics admin_audit_deleted = row_count;

  return next;
end;
$$;

-- Keep the existing admin audit append-only for every application role, but
-- permit the same private retention function to remove rows past 24 months.
create or replace function private.prevent_admin_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    and current_setting('app.analytics_retention', true) = 'on' then
    return old;
  end if;

  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;

drop trigger if exists admin_audit_log_append_only on public.admin_audit_log;
create trigger admin_audit_log_append_only
before update or delete on public.admin_audit_log
for each row execute function private.prevent_admin_audit_mutation();

revoke all on function private.analytics_metadata_allowed(text, jsonb) from public, anon, authenticated;
revoke all on function private.audit_metadata_allowed(text, jsonb) from public, anon, authenticated;
revoke all on function private.prevent_analytics_event_mutation() from public, anon, authenticated;
revoke all on function private.prevent_admin_audit_mutation() from public, anon, authenticated;
revoke all on function private.purge_expired_analytics_events() from public, anon, authenticated;

revoke all on function public.record_usage_event(uuid, text, text, text, text, text, uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_usage_event(uuid, text, text, text, text, text, uuid, text, text, text, text, text, jsonb) to authenticated;

revoke all on function public.record_audit_event(uuid, text, text, text, text, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_audit_event(uuid, text, text, text, text, text, uuid, text, jsonb) to authenticated;

revoke all on function public.admin_analytics_snapshot(integer) from public, anon, authenticated;
grant execute on function public.admin_analytics_snapshot(integer) to authenticated;
