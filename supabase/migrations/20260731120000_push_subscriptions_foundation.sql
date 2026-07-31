-- Fundament powiadomień Web Push: subskrypcje urządzeń.
--
-- Jedna osoba może mieć wiele urządzeń i przeglądarek, więc kluczem naturalnym
-- jest endpoint wystawiony przez dostawcę (FCM/Mozilla/Apple), a nie user_id.
--
-- Klucze p256dh i auth są materiałem kryptograficznym pozwalającym zaszyfrować
-- payload dla konkretnego urządzenia. Nie trafiają do żadnego UI ani logu:
-- authenticated nie dostaje na nie grantu kolumnowego, więc są nieczytelne
-- nawet dla właściciela subskrypcji. Czyta je wyłącznie dispatcher działający
-- jako service_role.
--
-- Zapisy idą wyłącznie przez security definer RPC — tak jak przy point_events
-- i meeting_game_responses. Brak polityk insert/update/delete jest tu
-- świadomym mechanizmem, nie przeoczeniem.

-- 1. Tabela subskrypcji -----------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null
    references public.profiles (id) on delete cascade,
  endpoint text not null unique
    check (length(btrim(endpoint)) > 0 and length(endpoint) <= 2000),
  p256dh text not null check (length(btrim(p256dh)) > 0),
  auth text not null check (length(btrim(auth)) > 0),
  user_agent text check (user_agent is null or length(user_agent) <= 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  disabled_at timestamptz
);

alter table public.push_subscriptions enable row level security;

-- Dispatcher i rozwijanie kampanii pytają zawsze o aktywne subskrypcje danego
-- użytkownika, stąd indeks częściowy zamiast pełnego po user_id.
create index push_subscriptions_active_user_idx
  on public.push_subscriptions (user_id)
  where disabled_at is null;

create trigger z_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row execute function private.set_updated_at();

-- 2. Polityki RLS -----------------------------------------------------------
--
-- Tylko select i tylko własnych wierszy. Świadomie NIE tworzymy polityk
-- insert/update/delete: brak polityki oznacza, że dla authenticated operacja
-- jest niemożliwa niezależnie od grantów.

create policy push_subscriptions_select_own
on public.push_subscriptions for select to authenticated
using (user_id = auth.uid());

-- 3. Granty -----------------------------------------------------------------
--
-- Grant kolumnowy z pominięciem p256dh i auth: nawet select własnego wiersza
-- nie ujawnia materiału kryptograficznego. Aplikacja czyta stan subskrypcji
-- przez get_own_push_subscription, a nie przez PostgREST — polityka wyżej
-- jest zabezpieczeniem na wypadek zapytań spoza aplikacji.

revoke all on public.push_subscriptions from public, anon, authenticated;

grant select (
  id,
  user_id,
  endpoint,
  user_agent,
  created_at,
  updated_at,
  last_success_at,
  last_failure_at,
  failure_count,
  disabled_at
) on public.push_subscriptions to authenticated;

grant select, insert, update, delete
  on public.push_subscriptions to service_role;

-- 4. Zapis subskrypcji ------------------------------------------------------
--
-- Endpoint bywa widoczny w narzędziach deweloperskich i w logach dostawcy, więc
-- sama jego znajomość nie może wystarczyć do przejęcia cudzej subskrypcji —
-- inaczej dowolny aktywny członek przekierowałby czyjeś powiadomienia na swoje
-- konto. Przepisanie właściciela wymaga zgodności pełnego zestawu
-- endpoint + p256dh + auth, czyli faktycznego posiadania subskrypcji.
--
-- Observer też może się zapisać: automatyczna kampania go pomija, ale
-- administrator może chcieć wysłać mu wiadomość ręcznie.

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_subscription_id uuid;
begin
  if current_user_id is null or not private.is_active_member() then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  if p_endpoint is null or length(btrim(p_endpoint)) = 0
    or p_p256dh is null or length(btrim(p_p256dh)) = 0
    or p_auth is null or length(btrim(p_auth)) = 0
  then
    raise exception 'Endpoint and subscription keys are required'
      using errcode = '22023';
  end if;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    user_agent
  )
  values (
    current_user_id,
    btrim(p_endpoint),
    btrim(p_p256dh),
    btrim(p_auth),
    left(btrim(coalesce(p_user_agent, '')), 400)
  )
  on conflict (endpoint) do update
  set user_id = current_user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent,
      disabled_at = null,
      failure_count = 0
  where public.push_subscriptions.user_id = current_user_id
     or (public.push_subscriptions.p256dh = excluded.p256dh
         and public.push_subscriptions.auth = excluded.auth)
  returning id into v_subscription_id;

  -- Klauzula where przy do update nie przepuściła aktualizacji: endpoint
  -- należy do kogoś innego, a podane klucze się nie zgadzają.
  --
  -- Osobny errcode (nie 42501), bo klient reaguje na ten przypadek inaczej niż
  -- na brak uprawnień: kasuje lokalną subskrypcję i subskrybuje się ponownie,
  -- dostając od dostawcy nowy endpoint.
  if v_subscription_id is null then
    raise exception 'Push subscription endpoint belongs to another user'
      using errcode = 'P0004';
  end if;

  return v_subscription_id;
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text)
from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text)
to authenticated;

-- 5. Wyłączenie subskrypcji na bieżącym urządzeniu --------------------------

create or replace function public.disable_push_subscription(
  p_endpoint text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_disabled boolean := false;
begin
  if current_user_id is null or not private.is_active_member() then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  update public.push_subscriptions
  set disabled_at = now()
  where endpoint = btrim(coalesce(p_endpoint, ''))
    and user_id = current_user_id
    and disabled_at is null
  returning true into v_disabled;

  return coalesce(v_disabled, false);
end;
$$;

revoke all on function public.disable_push_subscription(text)
from public, anon;
grant execute on function public.disable_push_subscription(text)
to authenticated;

-- 6. Odczyt stanu własnej subskrypcji ---------------------------------------
--
-- Kontrolka na /profil zna endpoint dopiero po stronie przeglądarki
-- (pushManager.getSubscription), więc pyta o stan po fakcie. Zwracamy sam
-- fakt istnienia i włączenia — nigdy kluczy.

create or replace function public.get_own_push_subscription(
  p_endpoint text
)
returns table (
  subscription_id uuid,
  is_enabled boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    subscription.id,
    subscription.disabled_at is null
  from public.push_subscriptions as subscription
  where subscription.endpoint = btrim(coalesce(p_endpoint, ''))
    and subscription.user_id = auth.uid();
$$;

revoke all on function public.get_own_push_subscription(text)
from public, anon;
grant execute on function public.get_own_push_subscription(text)
to authenticated;
