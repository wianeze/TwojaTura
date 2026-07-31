-- Kampanie Web Push, transakcyjny outbox i kolejka dostaw.
--
-- Model rozdziela dwa byty:
--   * push_campaigns  — jedna treść wysłana raz (automatycznie albo ręcznie),
--   * push_deliveries — jedna próba dostarczenia na jedno urządzenie.
--
-- Zbiór dostaw jest zamrażany w chwili tworzenia kampanii, w tej samej
-- transakcji co zdarzenie źródłowe. Zewnętrzna wysyłka Web Push następuje
-- dopiero po commicie, w dispatcherze Next.js działającym jako service_role —
-- dlatego awaria dostawcy nie ma żadnego wpływu na zdarzenie, które kampanię
-- wywołało.
--
-- To NIE jest centrum powiadomień: historia służy wyłącznie retry, kontroli
-- duplikatów i diagnostyce administratora. Zwykły użytkownik nie ma do niej
-- dostępu — obie tabele mają włączone RLS i zero polityk.
--
-- Semantyka statusów:
--   queued     — czeka na pierwszą próbę albo na retry (next_attempt_at),
--   processing — przejęta przez dispatcher,
--   sent       — przyjęta przez usługę push,
--   failed     — stan końcowy (limit prób, wygaśnięcie, błąd trwały),
--   skipped    — subskrypcja została wyłączona już PO utworzeniu dostawy.
--
-- Uwaga: użytkownik bez aktywnej subskrypcji nie dostaje rekordu dostawy
-- w ogóle i nie jest liczony jako skipped. To osobna metryka, raportowana
-- przy doborze odbiorców jako „bez aktywnego urządzenia”.

-- 1. Typy -------------------------------------------------------------------

create type public.push_campaign_kind as enum (
  'meeting_created',
  'admin_manual'
);

create type public.push_delivery_status as enum (
  'queued',
  'processing',
  'sent',
  'failed',
  'skipped'
);

-- 2. Kampanie ---------------------------------------------------------------

create table public.push_campaigns (
  id uuid primary key default extensions.gen_random_uuid(),
  kind public.push_campaign_kind not null,
  title text not null
    check (length(btrim(title)) > 0 and length(title) <= 80),
  body text not null
    check (length(btrim(body)) > 0 and length(body) <= 300),
  action_url text,
  source_entity_type text,
  source_entity_id uuid,
  template_key text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  dedupe_key text not null unique,
  -- Cel kliknięcia musi być ścieżką wewnątrz aplikacji. Odrzucamy adresy
  -- bezwzględne, protocol-relative (//host) i backslash-owe warianty, którymi
  -- przeglądarki potrafią dojść do obcego originu.
  constraint push_campaigns_action_url_internal_check check (
    action_url is null
    or (
      length(action_url) <= 300
      and action_url !~ '[[:cntrl:]]'
      and (action_url = '/' or action_url ~ '^/[^/\\]')
    )
  )
);

alter table public.push_campaigns enable row level security;

create index push_campaigns_created_at_idx
  on public.push_campaigns (created_at desc);

-- 3. Dostawy ----------------------------------------------------------------

create table public.push_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null
    references public.push_campaigns (id) on delete cascade,
  subscription_id uuid not null
    references public.push_subscriptions (id) on delete cascade,
  recipient_user_id uuid not null
    references public.profiles (id) on delete cascade,
  status public.push_delivery_status not null default 'queued',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  -- Wyłącznie krótki slug (http_410, network_timeout). Nigdy treść odpowiedzi
  -- dostawcy ani materiał kryptograficzny subskrypcji.
  last_error_code text
    check (last_error_code is null or length(last_error_code) <= 40),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint push_deliveries_unique_target unique (campaign_id, subscription_id)
);

alter table public.push_deliveries enable row level security;

create index push_deliveries_dispatch_idx
  on public.push_deliveries (next_attempt_at)
  where status = 'queued';

create index push_deliveries_campaign_idx
  on public.push_deliveries (campaign_id);

-- 4. Polityki i granty ------------------------------------------------------
--
-- Świadomie zero polityk na obu tabelach: dla authenticated są niewidoczne
-- i niezapisywalne. Administrator czyta je wyłącznie przez security definer
-- RPC, które nie zwracają endpointów ani kluczy.

revoke all on public.push_campaigns from public, anon, authenticated;
revoke all on public.push_deliveries from public, anon, authenticated;

grant select, insert, update, delete on public.push_campaigns to service_role;
grant select, insert, update, delete on public.push_deliveries to service_role;

-- 5. Wspólny zapis do outboxa -----------------------------------------------
--
-- p_recipient_user_ids = null oznacza „wszyscy aktywni z aktywną subskrypcją”.
-- Wywołania automatyczne przekazują zawsze jawną tablicę (możliwe że pustą),
-- żeby brak odbiorców nigdy nie zamienił się w wysyłkę do wszystkich.

create or replace function private.enqueue_push_campaign(
  p_kind public.push_campaign_kind,
  p_title text,
  p_body text,
  p_action_url text,
  p_source_entity_type text,
  p_source_entity_id uuid,
  p_template_key text,
  p_created_by uuid,
  p_dedupe_key text,
  p_recipient_user_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
begin
  if p_dedupe_key is null or length(btrim(p_dedupe_key)) = 0 then
    raise exception 'Campaign dedupe key is required'
      using errcode = '22023';
  end if;

  insert into public.push_campaigns (
    kind,
    title,
    body,
    action_url,
    source_entity_type,
    source_entity_id,
    template_key,
    created_by,
    dedupe_key
  )
  values (
    p_kind,
    btrim(p_title),
    btrim(p_body),
    nullif(btrim(coalesce(p_action_url, '')), ''),
    p_source_entity_type,
    p_source_entity_id,
    p_template_key,
    p_created_by,
    btrim(p_dedupe_key)
  )
  on conflict (dedupe_key) do nothing
  returning id into v_campaign_id;

  -- Kampania już istniała (podwójne kliknięcie, ponowne wywołanie). Zbiór
  -- odbiorców jest zamrożony przy pierwszym zakolejkowaniu, więc świadomie
  -- NIE rozwijamy dostaw drugi raz — urządzenie zarejestrowane później nie
  -- powinno dostać starego powiadomienia.
  if v_campaign_id is null then
    select campaign.id
    into v_campaign_id
    from public.push_campaigns as campaign
    where campaign.dedupe_key = btrim(p_dedupe_key);

    return v_campaign_id;
  end if;

  insert into public.push_deliveries (
    campaign_id,
    subscription_id,
    recipient_user_id
  )
  select
    v_campaign_id,
    subscription.id,
    subscription.user_id
  from public.push_subscriptions as subscription
  join public.app_members as membership
    on membership.user_id = subscription.user_id
  where subscription.disabled_at is null
    and membership.is_active = true
    and (
      p_recipient_user_ids is null
      or subscription.user_id = any (p_recipient_user_ids)
    )
  on conflict (campaign_id, subscription_id) do nothing;

  return v_campaign_id;
end;
$$;

revoke all on function private.enqueue_push_campaign(
  public.push_campaign_kind, text, text, text, text, uuid, text, uuid, text, uuid[]
) from public, anon, authenticated;

-- 6. Automatyczna kampania po utworzeniu spotkania --------------------------
--
-- Jedyny automatyczny push w całym systemie.
--
-- Świadomie BEZ bloku exception: zapis do outboxa jest częścią transakcji
-- tworzenia spotkania. Gdyby kolejkowanie mogło po cichu zniknąć, powstałoby
-- spotkanie, o którym nikt się nie dowie, i nie byłoby tego jak wykryć.
-- Wymóg „utworzenie spotkania nie może zostać cofnięte przez nieudaną wysyłkę”
-- spełnia sama architektura outboxa: zewnętrzne żądania Web Push wychodzą
-- dopiero po commicie, z dispatchera.
--
-- Audiencja to aktywni member i admin. Observer jest pomijany, bo nie może
-- głosować na gry, a treść wprost o to prosi. Autor spotkania jest w audiencji.

create or replace function private.enqueue_meeting_created_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue_push_campaign(
    'meeting_created'::public.push_campaign_kind,
    'Nowe spotkanie!',
    'Powstało spotkanie „'
      || left(btrim(new.title), 120)
      || '”. Wybierz gry, w które chcesz zagrać.',
    '/kalendarium/' || new.id::text,
    'meeting',
    new.id,
    'meeting_created',
    new.created_by,
    'meeting_created:' || new.id::text,
    -- coalesce do pustej tablicy jest krytyczny: null oznaczałby
    -- „wszyscy”, a brak pasujących ról ma oznaczać „nikt”.
    coalesce(
      (
        select array_agg(membership.user_id)
        from public.app_members as membership
        where membership.is_active = true
          and membership.role in (
            'member'::public.membership_role,
            'admin'::public.membership_role
          )
      ),
      '{}'::uuid[]
    )
  );

  return new;
end;
$$;

revoke all on function private.enqueue_meeting_created_push()
from public, anon, authenticated;

create trigger z_meetings_enqueue_push
after insert on public.meetings
for each row execute function private.enqueue_meeting_created_push();

-- 7. RPC administratora -----------------------------------------------------

-- Parametry opcjonalne mają DEFAULT null i stoją na końcu: dzięki temu
-- generator typów Supabase oznacza je jako opcjonalne i klient może je po
-- prostu pominąć. Bez tego generator opisałby je jako wymagane `text`/`uuid[]`
-- i przekazanie nulla wymagałoby rzutowania po stronie TypeScriptu.
create or replace function public.admin_create_push_campaign(
  p_title text,
  p_body text,
  p_idempotency_key text,
  p_action_url text default null,
  p_template_key text default null,
  p_recipient_user_ids uuid[] default null
)
returns table (
  campaign_id uuid,
  user_count integer,
  subscription_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
begin
  if not private.is_admin() then
    raise exception 'Administrator role is required'
      using errcode = '42501';
  end if;

  if p_title is null or length(btrim(p_title)) = 0
    or p_body is null or length(btrim(p_body)) = 0
  then
    raise exception 'Campaign title and body are required'
      using errcode = '22023';
  end if;

  if length(btrim(p_title)) > 80 or length(btrim(p_body)) > 300 then
    raise exception 'Campaign title or body is too long'
      using errcode = '22023';
  end if;

  if p_idempotency_key is null or length(btrim(p_idempotency_key)) = 0 then
    raise exception 'Idempotency key is required'
      using errcode = '22023';
  end if;

  -- Pusta tablica odbiorców to prawie na pewno pomyłka w UI; null (wszyscy)
  -- jest wyrażany jawnie, więc nie mylimy tych dwóch przypadków.
  if p_recipient_user_ids is not null
    and array_length(p_recipient_user_ids, 1) is null
  then
    raise exception 'Recipient list cannot be empty'
      using errcode = '22023';
  end if;

  v_campaign_id := private.enqueue_push_campaign(
    'admin_manual'::public.push_campaign_kind,
    p_title,
    p_body,
    p_action_url,
    null,
    null,
    nullif(btrim(coalesce(p_template_key, '')), ''),
    auth.uid(),
    'admin_manual:' || btrim(p_idempotency_key),
    p_recipient_user_ids
  );

  return query
  select
    v_campaign_id,
    count(distinct delivery.recipient_user_id)::integer,
    count(*)::integer
  from public.push_deliveries as delivery
  where delivery.campaign_id = v_campaign_id;
end;
$$;

revoke all on function public.admin_create_push_campaign(
  text, text, text, text, text, uuid[]
) from public, anon;
grant execute on function public.admin_create_push_campaign(
  text, text, text, text, text, uuid[]
) to authenticated;

create or replace function public.admin_list_push_audience()
returns table (
  user_id uuid,
  display_name text,
  role public.membership_role,
  active_subscription_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator role is required'
      using errcode = '42501';
  end if;

  return query
  select
    membership.user_id,
    profile.display_name,
    membership.role,
    count(subscription.id)::integer
  from public.app_members as membership
  join public.profiles as profile on profile.id = membership.user_id
  left join public.push_subscriptions as subscription
    on subscription.user_id = membership.user_id
    and subscription.disabled_at is null
  where membership.is_active = true
  group by membership.user_id, profile.display_name, membership.role
  order by profile.display_name asc;
end;
$$;

revoke all on function public.admin_list_push_audience() from public, anon;
grant execute on function public.admin_list_push_audience() to authenticated;

-- Liczby użytkowników i urządzeń są raportowane osobno, a „bez aktywnego
-- urządzenia” to trzecia, niezależna metryka — nie jest to skipped.
create or replace function public.admin_push_audience_summary(
  p_recipient_user_ids uuid[] default null
)
returns table (
  user_count integer,
  subscription_count integer,
  users_without_subscription integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator role is required'
      using errcode = '42501';
  end if;

  return query
  with candidates as (
    select membership.user_id
    from public.app_members as membership
    where membership.is_active = true
      and (
        p_recipient_user_ids is null
        or membership.user_id = any (p_recipient_user_ids)
      )
  ),
  devices as (
    select
      candidate.user_id,
      count(subscription.id)::integer as active_count
    from candidates as candidate
    left join public.push_subscriptions as subscription
      on subscription.user_id = candidate.user_id
      and subscription.disabled_at is null
    group by candidate.user_id
  )
  select
    count(*) filter (where devices.active_count > 0)::integer,
    coalesce(sum(devices.active_count), 0)::integer,
    count(*) filter (where devices.active_count = 0)::integer
  from devices;
end;
$$;

revoke all on function public.admin_push_audience_summary(uuid[])
from public, anon;
grant execute on function public.admin_push_audience_summary(uuid[])
to authenticated;

create or replace function public.admin_list_push_campaigns(
  p_limit integer default 20
)
returns table (
  id uuid,
  kind public.push_campaign_kind,
  title text,
  body text,
  action_url text,
  template_key text,
  created_at timestamptz,
  created_by_name text,
  recipient_user_count integer,
  device_count integer,
  sent_count integer,
  queued_count integer,
  failed_count integer,
  skipped_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator role is required'
      using errcode = '42501';
  end if;

  return query
  select
    campaign.id,
    campaign.kind,
    campaign.title,
    campaign.body,
    campaign.action_url,
    campaign.template_key,
    campaign.created_at,
    author.display_name,
    count(distinct delivery.recipient_user_id)::integer,
    count(delivery.id)::integer,
    count(delivery.id) filter (
      where delivery.status = 'sent'::public.push_delivery_status
    )::integer,
    count(delivery.id) filter (
      where delivery.status in (
        'queued'::public.push_delivery_status,
        'processing'::public.push_delivery_status
      )
    )::integer,
    count(delivery.id) filter (
      where delivery.status = 'failed'::public.push_delivery_status
    )::integer,
    count(delivery.id) filter (
      where delivery.status = 'skipped'::public.push_delivery_status
    )::integer
  from public.push_campaigns as campaign
  left join public.profiles as author on author.id = campaign.created_by
  left join public.push_deliveries as delivery
    on delivery.campaign_id = campaign.id
  group by campaign.id, author.display_name
  order by campaign.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
end;
$$;

revoke all on function public.admin_list_push_campaigns(integer)
from public, anon;
grant execute on function public.admin_list_push_campaigns(integer)
to authenticated;

-- „Ponów oczekujące teraz”. Dotyka wyłącznie dostaw, które i tak czekają
-- w kolejce na kolejną próbę — failed jest stanem końcowym i nic go nie
-- wskrzesza, sent i skipped też nie wracają do kolejki.
create or replace function public.admin_reschedule_pending_push_deliveries()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rescheduled integer;
begin
  if not private.is_admin() then
    raise exception 'Administrator role is required'
      using errcode = '42501';
  end if;

  with rescheduled as (
    update public.push_deliveries as delivery
    set next_attempt_at = now()
    where delivery.status = 'queued'::public.push_delivery_status
      and delivery.attempt_count > 0
      and delivery.attempt_count < 5
      and delivery.next_attempt_at > now()
    returning 1
  )
  select count(*)::integer into v_rescheduled from rescheduled;

  return v_rescheduled;
end;
$$;

revoke all on function public.admin_reschedule_pending_push_deliveries()
from public, anon;
grant execute on function public.admin_reschedule_pending_push_deliveries()
to authenticated;

-- 8. RPC dispatchera --------------------------------------------------------
--
-- Wyłącznie service_role: te funkcje zwracają materiał kryptograficzny
-- subskrypcji, więc authenticated nie dostaje na nie grantu w ogóle.

create or replace function public.claim_push_deliveries(
  p_limit integer default 50
)
returns table (
  delivery_id uuid,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth_secret text,
  title text,
  body text,
  action_url text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  -- Odzysk po awarii funkcji serverless: dostawa przejęta i porzucona wraca
  -- do kolejki. attempt_count został już podniesiony przy przejęciu, więc
  -- crash nie może zapętlić się w nieskończoność.
  update public.push_deliveries as delivery
  set status = 'queued'::public.push_delivery_status,
      claimed_at = null
  where delivery.status = 'processing'::public.push_delivery_status
    and delivery.claimed_at < now() - interval '10 minutes';

  -- Subskrypcja wyłączona już PO utworzeniu dostawy. To nie jest błąd
  -- dostawcy, więc status brzmi skipped, nie failed.
  update public.push_deliveries as delivery
  set status = 'skipped'::public.push_delivery_status,
      last_error_code = 'subscription_disabled'
  from public.push_subscriptions as subscription
  where subscription.id = delivery.subscription_id
    and delivery.status = 'queued'::public.push_delivery_status
    and subscription.disabled_at is not null;

  return query
  with claimed as (
    select delivery.id
    from public.push_deliveries as delivery
    where delivery.status = 'queued'::public.push_delivery_status
      and delivery.next_attempt_at <= now()
    order by delivery.next_attempt_at asc
    limit v_limit
    for update skip locked
  ),
  taken as (
    update public.push_deliveries as delivery
    set status = 'processing'::public.push_delivery_status,
        attempt_count = delivery.attempt_count + 1,
        claimed_at = now()
    where delivery.id in (select claimed.id from claimed)
    returning
      delivery.id as taken_id,
      delivery.campaign_id as taken_campaign_id,
      delivery.subscription_id as taken_subscription_id,
      delivery.attempt_count as taken_attempt_count
  )
  select
    taken.taken_id,
    taken.taken_subscription_id,
    subscription.endpoint,
    subscription.p256dh,
    subscription.auth,
    campaign.title,
    campaign.body,
    campaign.action_url,
    taken.taken_attempt_count
  from taken
  join public.push_subscriptions as subscription
    on subscription.id = taken.taken_subscription_id
  join public.push_campaigns as campaign
    on campaign.id = taken.taken_campaign_id;
end;
$$;

revoke all on function public.claim_push_deliveries(integer)
from public, anon, authenticated;
grant execute on function public.claim_push_deliveries(integer)
to service_role;

create or replace function public.complete_push_delivery(
  p_delivery_id uuid,
  p_outcome text,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Ostatnia linia obrony przed wyciekiem odpowiedzi dostawcy do bazy:
  -- z kodu błędu zostaje wyłącznie krótki, bezpieczny slug.
  v_error_code text := nullif(
    left(regexp_replace(coalesce(p_error_code, ''), '[^a-zA-Z0-9_:-]', '', 'g'), 40),
    ''
  );
  v_attempt_count integer;
  v_subscription_id uuid;
begin
  select delivery.attempt_count, delivery.subscription_id
  into v_attempt_count, v_subscription_id
  from public.push_deliveries as delivery
  where delivery.id = p_delivery_id;

  if v_subscription_id is null then
    raise exception 'Push delivery does not exist'
      using errcode = '23503';
  end if;

  if p_outcome = 'sent' then
    update public.push_deliveries
    set status = 'sent'::public.push_delivery_status,
        sent_at = now(),
        last_error_code = null
    where id = p_delivery_id;

    update public.push_subscriptions
    set last_success_at = now(),
        failure_count = 0
    where id = v_subscription_id;

  elsif p_outcome = 'expired_subscription' then
    update public.push_deliveries
    set status = 'failed'::public.push_delivery_status,
        failed_at = now(),
        last_error_code = v_error_code
    where id = p_delivery_id;

    -- Jedyny przypadek wyłączający subskrypcję: dostawca potwierdził, że
    -- endpoint już nie istnieje (404/410).
    update public.push_subscriptions
    set disabled_at = coalesce(disabled_at, now()),
        last_failure_at = now(),
        failure_count = failure_count + 1
    where id = v_subscription_id;

  elsif p_outcome = 'permanent_failure' then
    -- Świadomie BEZ disabled_at: 403 to najczęściej niezgodny klucz VAPID,
    -- czyli błąd konfiguracji serwera, a nie martwe urządzenie.
    update public.push_deliveries
    set status = 'failed'::public.push_delivery_status,
        failed_at = now(),
        last_error_code = v_error_code
    where id = p_delivery_id;

    update public.push_subscriptions
    set last_failure_at = now(),
        failure_count = failure_count + 1
    where id = v_subscription_id;

  elsif p_outcome = 'retryable_failure' then
    if v_attempt_count >= 5 then
      update public.push_deliveries
      set status = 'failed'::public.push_delivery_status,
          failed_at = now(),
          last_error_code = v_error_code
      where id = p_delivery_id;
    else
      update public.push_deliveries
      set status = 'queued'::public.push_delivery_status,
          claimed_at = null,
          last_error_code = v_error_code,
          next_attempt_at = now() + case v_attempt_count
            when 1 then interval '5 minutes'
            when 2 then interval '30 minutes'
            when 3 then interval '2 hours'
            else interval '12 hours'
          end
      where id = p_delivery_id;
    end if;

    update public.push_subscriptions
    set last_failure_at = now(),
        failure_count = failure_count + 1
    where id = v_subscription_id;

  else
    raise exception 'Unsupported push delivery outcome'
      using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.complete_push_delivery(uuid, text, text)
from public, anon, authenticated;
grant execute on function public.complete_push_delivery(uuid, text, text)
to service_role;
